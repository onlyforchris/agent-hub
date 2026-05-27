package com.efloow.agenthub.application.session;

import com.efloow.agenthub.domain.agent.ConfirmResponse;
import com.efloow.agenthub.system.service.ConversationRecordService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

@Component
public class AgentSessionManager {

    private static final Logger log = LoggerFactory.getLogger(AgentSessionManager.class);
    private static final int MAX_CONTEXT_CHARS = 12_000;
    private static final int WARN_CONTEXT_CHARS = 9_000;
    private static final int MAX_CONTEXT_TURNS = 20;

    private final ConcurrentHashMap<String, CompletableFuture<ConfirmResponse>> pendingConfirmations
        = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<ConversationTurn>> conversations
        = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastAccessTime = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> sessionSummary = new ConcurrentHashMap<>();
    private final ObjectProvider<ConversationRecordService> conversationRecordServiceProvider;

    public AgentSessionManager(ObjectProvider<ConversationRecordService> conversationRecordServiceProvider) {
        this.conversationRecordServiceProvider = conversationRecordServiceProvider;
    }

    public ConversationSnapshot snapshot(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return ConversationSnapshot.empty();
        }
        touchSession(sessionId);
        List<ConversationTurn> turns = conversations.getOrDefault(sessionId, new CopyOnWriteArrayList<>());
        List<ConversationTurn> recentTurns = trimToBudget(turns);
        int usedChars = recentTurns.stream().mapToInt(ConversationTurn::charCount).sum();
        boolean nearLimit = usedChars >= WARN_CONTEXT_CHARS || turns.size() >= MAX_CONTEXT_TURNS;
        String summary = sessionSummary.get(sessionId);
        return new ConversationSnapshot(
            recentTurns,
            usedChars,
            MAX_CONTEXT_CHARS,
            nearLimit,
            summary,
            nearLimit && summary == null
        );
    }

    public void appendTurn(String sessionId, String turnId, String userInput, String agentReply, String agentId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        touchSession(sessionId);
        ConversationTurn turn = new ConversationTurn(
            turnId != null ? turnId : "",
            userInput != null ? userInput : "",
            agentReply != null ? agentReply : "",
            agentId != null ? agentId : "",
            System.currentTimeMillis()
        );
        CopyOnWriteArrayList<ConversationTurn> turns =
            conversations.computeIfAbsent(sessionId, ignored -> new CopyOnWriteArrayList<>());
        turns.add(turn);
        while (turns.size() > MAX_CONTEXT_TURNS) {
            turns.remove(0);
        }
        log.debug("conversation turn appended: sessionId={}, turns={}, chars={}",
            sessionId, turns.size(), snapshot(sessionId).usedChars());
        ConversationRecordService recordService = conversationRecordServiceProvider.getIfAvailable();
        if (recordService != null) {
            recordService.appendTurn(sessionId, turnId, userInput, agentReply, agentId);
        }
    }

    /**
     * Register a pending confirmation and block until user responds or timeout.
     */
    public ConfirmResponse waitForConfirmation(String sessionId, String confirmId, long timeoutSeconds) {
        String key = key(sessionId, confirmId);
        CompletableFuture<ConfirmResponse> future = new CompletableFuture<>();
        pendingConfirmations.put(key, future);
        log.info("confirmation waiting: sessionId={}, confirmId={}", sessionId, confirmId);

        try {
            return future.get(timeoutSeconds, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("confirmation timeout or interrupted: sessionId={}, confirmId={}", sessionId, confirmId);
            pendingConfirmations.remove(key);
            return new ConfirmResponse(confirmId, false, "timeout");
        }
    }

    /**
     * Resolve a pending confirmation from the user's HTTP request.
     */
    public boolean resolveConfirmation(String sessionId, String confirmId, boolean approved, String comment) {
        String key = key(sessionId, confirmId);
        CompletableFuture<ConfirmResponse> future = pendingConfirmations.remove(key);
        if (future == null) {
            log.warn("confirmation not found: sessionId={}, confirmId={}", sessionId, confirmId);
            return false;
        }
        boolean done = future.complete(new ConfirmResponse(confirmId, approved, comment));
        log.info("confirmation resolved: sessionId={}, confirmId={}, approved={}, done={}",
            sessionId, confirmId, approved, done);
        return done;
    }

    public void cancelPending(String sessionId) {
        pendingConfirmations.entrySet().removeIf(entry -> {
            if (entry.getKey().startsWith(sessionId + ":")) {
                entry.getValue().complete(new ConfirmResponse("", false, "session cancelled"));
                return true;
            }
            return false;
        });
    }

    public void storeSummary(String sessionId, String summary) {
        if (sessionId != null && summary != null && !summary.isBlank()) {
            sessionSummary.put(sessionId, summary);
            log.info("session summary stored: sessionId={}, summaryLen={}", sessionId, summary.length());
        }
    }

    public String getSummary(String sessionId) {
        return sessionId != null ? sessionSummary.get(sessionId) : null;
    }

    /**
     * Return the oldest half of turns for summarization.
     * Returns empty list if summarization is not needed (under budget).
     */
    public List<ConversationTurn> getTurnsForSummarization(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return List.of();
        }
        List<ConversationTurn> turns = conversations.get(sessionId);
        if (turns == null || turns.isEmpty()) {
            return List.of();
        }
        int totalChars = turns.stream().mapToInt(ConversationTurn::charCount).sum();
        if (totalChars < MAX_CONTEXT_CHARS && turns.size() < MAX_CONTEXT_TURNS) {
            return List.of();
        }
        // Return oldest half
        int count = Math.max(1, turns.size() / 2);
        return List.copyOf(turns.subList(0, count));
    }

    public void clearConversation(String sessionId) {
        if (sessionId != null) {
            conversations.remove(sessionId);
            lastAccessTime.remove(sessionId);
            sessionSummary.remove(sessionId);
        }
        cancelPending(sessionId);
    }

    private void touchSession(String sessionId) {
        lastAccessTime.put(sessionId, System.currentTimeMillis());
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 300_000)
    public void evictExpiredSessions() {
        long cutoff = System.currentTimeMillis() - TimeUnit.MILLISECONDS.convert(30, TimeUnit.MINUTES);
        lastAccessTime.entrySet().removeIf(entry -> {
            if (entry.getValue() < cutoff) {
                String sessionId = entry.getKey();
                conversations.remove(sessionId);
                sessionSummary.remove(sessionId);
                cancelPending(sessionId);
                log.info("session evicted: sessionId={}", sessionId);
                return true;
            }
            return false;
        });
    }

    private String key(String sessionId, String confirmId) {
        return sessionId + ":" + confirmId;
    }

    private List<ConversationTurn> trimToBudget(List<ConversationTurn> turns) {
        List<ConversationTurn> selected = new ArrayList<>();
        int chars = 0;
        for (int i = turns.size() - 1; i >= 0; i--) {
            ConversationTurn turn = turns.get(i);
            int nextChars = chars + turn.charCount();
            if (!selected.isEmpty() && nextChars > MAX_CONTEXT_CHARS) {
                break;
            }
            selected.add(0, turn);
            chars = nextChars;
        }
        return selected;
    }

    public record ConversationTurn(
        String turnId,
        String userInput,
        String agentReply,
        String agentId,
        long timestamp
    ) {
        public int charCount() {
            return userInput.length() + agentReply.length();
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("turnId", turnId);
            map.put("userInput", userInput);
            map.put("agentReply", agentReply);
            map.put("agentId", agentId);
            map.put("timestamp", timestamp);
            return map;
        }
    }

    public record ConversationSnapshot(
        List<ConversationTurn> turns,
        int usedChars,
        int maxChars,
        boolean nearLimit,
        String summary,
        boolean needsSummarization
    ) {
        public static ConversationSnapshot empty() {
            return new ConversationSnapshot(List.of(), 0, MAX_CONTEXT_CHARS, false, null, false);
        }

        public List<Map<String, Object>> turnMaps() {
            return turns.stream().map(ConversationTurn::toMap).toList();
        }
    }
}
