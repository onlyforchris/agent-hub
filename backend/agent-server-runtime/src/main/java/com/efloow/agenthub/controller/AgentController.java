package com.efloow.agenthub.controller;

import com.efloow.agenthub.application.llm.LlmGateway;
import com.efloow.agenthub.application.session.AgentSessionManager;
import com.efloow.agenthub.application.skill.SkillConfirmAuditService;
import com.efloow.agenthub.application.skill.SkillContextBinder;
import com.efloow.agenthub.application.skill.SkillForkExecutor;
import com.efloow.agenthub.domain.skill.SkillRouteResult;
import com.efloow.agenthub.common.response.AgentResponse;
import com.efloow.agenthub.common.security.AccessControlService;
import com.efloow.agenthub.common.trace.TraceContext;
import com.efloow.agenthub.domain.agent.*;
import com.efloow.agenthub.base.AgentBase;
import com.efloow.agenthub.base.ReActAgentBase;
import com.efloow.agenthub.router.AgentRouter;
import com.efloow.agenthub.router.AgentRouter.RoutingResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

@RestController
@RequestMapping("/api/agent")
public class AgentController {

    private static final Logger log = LoggerFactory.getLogger(AgentController.class);

    private final AgentRouter agentRouter;
    private final AgentSessionManager sessionManager;
    private final LlmGateway llmGateway;
    private final ObjectProvider<AccessControlService> accessControlService;
    private final ObjectMapper objectMapper;
    private final SkillContextBinder skillContextBinder;
    private final SkillConfirmAuditService skillConfirmAuditService;
    private final SkillForkExecutor skillForkExecutor;
    private final ExecutorService streamExecutor = Executors.newCachedThreadPool();
    private final Map<String, AtomicReference<SseEmitter>> activeStreams = new ConcurrentHashMap<>();

    public AgentController(AgentRouter agentRouter,
                           AgentSessionManager sessionManager,
                           LlmGateway llmGateway,
                           ObjectProvider<AccessControlService> accessControlService,
                           ObjectMapper objectMapper,
                           SkillContextBinder skillContextBinder,
                           SkillConfirmAuditService skillConfirmAuditService,
                           SkillForkExecutor skillForkExecutor) {
        this.agentRouter = agentRouter;
        this.sessionManager = sessionManager;
        this.llmGateway = llmGateway;
        this.accessControlService = accessControlService;
        this.objectMapper = objectMapper;
        this.skillContextBinder = skillContextBinder;
        this.skillConfirmAuditService = skillConfirmAuditService;
        this.skillForkExecutor = skillForkExecutor;
    }

    public record AskRequest(
        @NotBlank String input,
        String agentId,
        String sessionId,
        String turnId,
        String skillCode,
        java.util.List<String> workspacePaths
    ) {}

    @PostMapping("/ask")
    public AgentResponse<Map<String, Object>> ask(@Valid @RequestBody AskRequest request) {
        String traceId = MDC.get("traceId");
        if (traceId == null) {
            traceId = java.util.UUID.randomUUID().toString();
            MDC.put("traceId", traceId);
        }

        String sessionId = request.sessionId() != null ? request.sessionId() : java.util.UUID.randomUUID().toString();
        MDC.put("sessionId", sessionId);
        String turnId = resolveTurnId(request.turnId());
        MDC.put("turnId", turnId);

        log.info("agent ask: input={}, agentId={}, sessionId={}",
            request.input(), request.agentId(), sessionId);

        AgentSessionManager.ConversationSnapshot snapshot = sessionManager.snapshot(sessionId);
        SessionContext ctx = new SessionContext(
            "current-user",
            sessionId,
            request.agentId(),
            "LEVEL_3",
            conversationVariables(snapshot)
        );

        RoutingResult routing = agentRouter.route(request.input(), request.agentId(), ctx);

        // Chat reply (non-task)
        if (routing.agent() == null) {
            log.info("agent ask routed to chat: reasoning={}", routing.reasoning());
            sessionManager.appendTurn(sessionId, turnId, request.input(), routing.reply(), "chat");
            triggerSummarization(sessionId);
            return AgentResponse.ok(traceId, Map.of(
                "reply", routing.reply(),
                "type", "chat"
            ));
        }

        // Execute agent
        log.info("agent ask routed to agent: agentId={}, intent={}, reasoning={}",
            routing.agent().info().id(), routing.intent().action(), routing.reasoning());

        try {
            SkillRouteResult skillRoute = skillContextBinder.bind(
                ctx,
                routing.agent().info().id(),
                request.input(),
                request.skillCode(),
                request.workspacePaths()
            );
            if (skillRoute.skillCode() != null) {
                log.info("skill routed: code={}, matchedBy={}", skillRoute.skillCode(), skillRoute.matchedBy());
            }

            AgentResult result = executeAgent(routing.agent(), routing.intent(), ctx, skillRoute);
            sessionManager.appendTurn(sessionId, turnId, request.input(), result.reply(), routing.agent().info().id());
            triggerSummarization(sessionId);

            Map<String, Object> responseData = new java.util.LinkedHashMap<>();
            responseData.put("reply", result.reply());
            responseData.put("data", result.data());
            responseData.put("actions", result.actions());
            responseData.put("agentId", routing.agent().info().id());
            responseData.put("skillCode", skillRoute.skillCode());
            responseData.put("traceId", traceId);

            return AgentResponse.ok(traceId, responseData);
        } finally {
            skillContextBinder.clear();
        }
    }

    public record ConfirmRequest(
        @NotBlank String sessionId,
        @NotBlank String confirmId,
        boolean approved,
        String comment
    ) {}

    @PostMapping("/confirm")
    public AgentResponse<Map<String, Object>> confirm(@Valid @RequestBody ConfirmRequest request) {
        String traceId = MDC.get("traceId");
        log.info("agent confirm: sessionId={}, confirmId={}, approved={}",
            request.sessionId(), request.confirmId(), request.approved());

        boolean resolved = sessionManager.resolveConfirmation(
            request.sessionId(), request.confirmId(), request.approved(), request.comment());

        if (resolved) {
            skillConfirmAuditService.recordDecision(
                request.sessionId(), request.confirmId(), request.approved(), request.comment());
        }

        return AgentResponse.ok(traceId, Map.of(
            "confirmed", resolved,
            "confirmId", request.confirmId()
        ));
    }

    public record ClearSessionRequest(
        @NotBlank String sessionId
    ) {}

    @PostMapping("/session/clear")
    public AgentResponse<Map<String, Object>> clearSession(@Valid @RequestBody ClearSessionRequest request) {
        String traceId = MDC.get("traceId");
        String sessionId = request.sessionId();

        log.info("session clear: sessionId={}", sessionId);

        // 1. Close active SSE stream
        AtomicReference<SseEmitter> ref = activeStreams.remove(sessionId);
        if (ref != null) {
            SseEmitter emitter = ref.get();
            if (emitter != null) {
                completeEmitter(emitter, traceId);
            }
        }

        // 2. Clear conversation turns and pending confirmations
        sessionManager.clearConversation(sessionId);

        return AgentResponse.ok(traceId, Map.of(
            "cleared", true,
            "sessionId", sessionId
        ));
    }

    @GetMapping("/catalog")
    public AgentResponse<List<Map<String, Object>>> catalog() {
        String traceId = MDC.get("traceId");
        List<Map<String, Object>> agents = agentRouter.agents().values().stream()
            .map(a -> {
                AgentInfo info = a.info();
                Map<String, Object> map = new java.util.LinkedHashMap<>();
                map.put("id", info.id());
                map.put("name", info.name());
                map.put("description", info.description());
                map.put("permissionLevel", info.permissionLevel());
                map.put("skills", info.skills().stream()
                    .map(s -> Map.of("key", s.key(), "name", s.name(), "description", s.description()))
                    .toList());
                return map;
            })
            .toList();
        return AgentResponse.ok(traceId, agents);
    }

    @PostMapping(value = "/ask/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter askStream(@Valid @RequestBody AskRequest request) {
        String traceId = MDC.get("traceId");
        if (traceId == null || traceId.isBlank()) {
            traceId = java.util.UUID.randomUUID().toString();
            MDC.put("traceId", traceId);
        }
        final String finalTraceId = traceId;

        final String sessionId = request.sessionId() != null
            ? request.sessionId()
            : java.util.UUID.randomUUID().toString();
        MDC.put("sessionId", sessionId);
        final String turnId = resolveTurnId(request.turnId());
        MDC.put("turnId", turnId);

        log.info("agent ask stream: input={}, agentId={}, sessionId={}",
            request.input(), request.agentId(), sessionId);

        final SseEmitter emitter = new SseEmitter(300_000L); // 5 min timeout
        AtomicReference<SseEmitter> previous = activeStreams.computeIfAbsent(sessionId, ignored -> new AtomicReference<>());
        SseEmitter superseded = previous.getAndSet(emitter);
        if (superseded != null) {
            completeEmitter(superseded, finalTraceId);
        }

        AgentSessionManager.ConversationSnapshot snapshot = sessionManager.snapshot(sessionId);
        SessionContext ctx = new SessionContext(
            "current-user",
            sessionId,
            request.agentId(),
            "LEVEL_3",
            conversationVariables(snapshot)
        );

        ctx.eventSink(event -> {
            try {
                String json = objectMapper.writeValueAsString(event);
                emitter.send(SseEmitter.event()
                    .name(event.type())
                    .data(json, MediaType.APPLICATION_JSON));
            } catch (IOException e) {
                log.warn("sse send failed: traceId={}", finalTraceId, e);
            }
        });

        final SecurityContext securityContext = SecurityContextHolder.getContext();
        streamExecutor.execute(TraceContext.wrap(() -> {
            SecurityContextHolder.setContext(securityContext);
            try {
                if (previous.get() != emitter) {
                    log.warn("sse stream superseded: sessionId={}, traceId={}", sessionId, finalTraceId);
                    completeEmitter(emitter, finalTraceId);
                    return;
                }
                emitContextWarningIfNeeded(ctx, snapshot);
                RoutingResult routing = agentRouter.route(request.input(), request.agentId(), ctx);

                if (routing.agent() == null) {
                    log.info("agent ask stream routed to chat: reasoning={}", routing.reasoning());
                    ctx.emit(AgentStreamEvent.step("chat", routing.reply(),
                        Map.of("type", "chat")));
                    ctx.emit(AgentStreamEvent.token(routing.reply()));
                    sessionManager.appendTurn(sessionId, turnId, request.input(), routing.reply(), "chat");
                    triggerSummarization(sessionId);
                    emitter.complete();
                    return;
                }

                log.info("agent ask stream routed to agent: agentId={}, intent={}",
                    routing.agent().info().id(), routing.intent().action());

                try {
                    SkillRouteResult skillRoute = skillContextBinder.bind(
                        ctx,
                        routing.agent().info().id(),
                        request.input(),
                        request.skillCode(),
                        request.workspacePaths()
                    );
                    if (skillRoute.skillCode() != null) {
                        ctx.emit(AgentStreamEvent.step("skill", "已加载 Skill: " + skillRoute.skillCode(),
                            Map.of("skillCode", skillRoute.skillCode(), "matchedBy", skillRoute.matchedBy())));
                    }

                    AgentResult result = executeAgent(routing.agent(), routing.intent(), ctx, skillRoute);
                    sessionManager.appendTurn(sessionId, turnId, request.input(), result.reply(), routing.agent().info().id());
                    triggerSummarization(sessionId);
                    completeEmitter(emitter, finalTraceId);
                } finally {
                    skillContextBinder.clear();
                }
            } catch (Exception e) {
                log.error("agent ask stream failed: traceId={}", finalTraceId, e);
                try {
                    ctx.emit(AgentStreamEvent.error(e.getMessage()));
                } catch (Exception ignored) { }
                completeEmitterWithError(emitter, e, finalTraceId);
            } finally {
                SecurityContextHolder.clearContext();
                previous.compareAndSet(emitter, null);
            }
        }));

        emitter.onTimeout(() -> {
            log.warn("sse timeout: traceId={}", finalTraceId);
            previous.compareAndSet(emitter, null);
            completeEmitter(emitter, finalTraceId);
        });

        emitter.onError(throwable -> {
            previous.compareAndSet(emitter, null);
            if (isClientDisconnect(throwable)) {
                log.warn("sse client disconnected: traceId={}", finalTraceId);
            } else {
                log.error("sse error: traceId={}", finalTraceId, throwable);
            }
        });

        return emitter;
    }

    private void completeEmitter(SseEmitter emitter, String traceId) {
        try {
            emitter.complete();
        } catch (Exception e) {
            log.warn("sse complete failed (client likely disconnected): traceId={}", traceId);
        }
    }

    private void completeEmitterWithError(SseEmitter emitter, Throwable error, String traceId) {
        try {
            emitter.completeWithError(error);
        } catch (Exception e) {
            log.warn("sse completeWithError failed (client likely disconnected): traceId={}", traceId);
        }
    }

    private boolean isClientDisconnect(Throwable throwable) {
        if (throwable == null) return false;
        String msg = throwable.getMessage();
        if (msg != null && (msg.contains("中止了一个已建立的连接")
            || msg.contains("aborted")
            || msg.contains("broken pipe"))) {
            return true;
        }
        return isClientDisconnect(throwable.getCause());
    }

    private Map<String, Object> conversationVariables(AgentSessionManager.ConversationSnapshot snapshot) {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("conversationTurns", snapshot.turnMaps());
        variables.put("contextUsedChars", snapshot.usedChars());
        variables.put("contextMaxChars", snapshot.maxChars());
        variables.put("contextNearLimit", snapshot.nearLimit());
        if (snapshot.summary() != null) {
            variables.put("sessionSummary", snapshot.summary());
        }
        variables.put("needsSummarization", snapshot.needsSummarization());
        return variables;
    }

    private void emitContextWarningIfNeeded(SessionContext ctx, AgentSessionManager.ConversationSnapshot snapshot) {
        if (!snapshot.nearLimit()) {
            return;
        }
        ctx.emit(AgentStreamEvent.step("context",
            "当前会话上下文接近上限，后续可能遗忘较早内容。建议点击“新消息”开启新会话。",
            Map.of(
                "type", "context",
                "usedChars", snapshot.usedChars(),
                "maxChars", snapshot.maxChars()
            )));
    }

    private AgentResult executeAgent(
            AgentBase agent,
            Intent intent,
            SessionContext ctx,
            SkillRouteResult skillRoute
    ) {
        if (!(agent instanceof ReActAgentBase)
                && skillRoute.skill() != null
                && "fork".equals(skillRoute.skill().contextMode())) {
            String userInput = intent.paramString("input");
            return skillForkExecutor.executeFork(
                    skillRoute.skill(),
                    userInput != null ? userInput : "",
                    ctx,
                    agent
            );
        }
        return agent.execute(intent, ctx);
    }

    private String resolveTurnId(String turnId) {
        return turnId != null && !turnId.isBlank()
            ? turnId
            : "turn-" + java.util.UUID.randomUUID();
    }

    private void triggerSummarization(String sessionId) {
        List<AgentSessionManager.ConversationTurn> turns = sessionManager.getTurnsForSummarization(sessionId);
        if (turns.isEmpty()) {
            return;
        }
        streamExecutor.execute(TraceContext.wrap(() -> {
            try {
                String conversationText = turns.stream()
                    .map(t -> "用户: " + t.userInput() + "\n助手: " + t.agentReply())
                    .collect(Collectors.joining("\n"));
                String prompt = "请将以下对话历史压缩为一段简短的中文摘要（不超过 200 字），保留关键信息：话题、地点、日期、人名、待办事项、重要数字。";
                List<LlmGateway.Message> messages = List.of(
                    LlmGateway.Message.system(prompt),
                    LlmGateway.Message.user(conversationText)
                );
                LlmGateway.LlmResult result = llmGateway.chat(
                    "deepseek", null, messages, LlmGateway.LlmOptions.DEFAULT);
                String summary = result.content();
                if (summary != null && !summary.isBlank()) {
                    sessionManager.storeSummary(sessionId, summary.trim());
                }
            } catch (Exception e) {
                log.warn("session summarization failed: sessionId={}", sessionId, e);
            }
        }));
    }
}
