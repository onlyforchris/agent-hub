package com.efloow.agenthub.router;

import com.efloow.agenthub.application.llm.LlmGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.stream.Collectors;

@Component
public class Gatekeeper {

    private static final Logger log = LoggerFactory.getLogger(Gatekeeper.class);

    private final LlmGateway llmGateway;

    public Gatekeeper(LlmGateway llmGateway) {
        this.llmGateway = llmGateway;
    }

    public enum GateType { CHAT, TASK }

    public record GateDecision(GateType type, String reasoning) {}

    public GateDecision classify(String userInput, Map<String, ?> agentMap) {
        String prompt = buildPrompt(agentMap);
        try {
            String response = llmGateway.complete("deepseek", "null", prompt, userInput);
            String trimmed = response != null ? response.trim().toUpperCase() : "";
            if (trimmed.contains("TASK")) {
                log.debug("gatekeeper: type=TASK, input={}", userInput);
                return new GateDecision(GateType.TASK, "routed to task");
            }
            log.debug("gatekeeper: type=CHAT, input={}", userInput);
            return new GateDecision(GateType.CHAT, "routed to chat");
        } catch (Exception e) {
            log.warn("gatekeeper: llm unavailable, defaulting to TASK");
            return new GateDecision(GateType.TASK, "llm unavailable, defaulting to task");
        }
    }

    private String buildPrompt(Map<String, ?> agentMap) {
        String agentDescriptions = agentMap.values().stream()
            .map(a -> {
                if (a instanceof com.efloow.agenthub.base.AgentBase agent) {
                    return "- " + agent.info().name() + ": " + agent.routeHint();
                }
                return "";
            })
            .filter(s -> !s.isBlank())
            .collect(Collectors.joining("\n"));

        return """
            You are a request classifier for an AI agent platform.
            Classify the user's input as one of:
            - CHAT: casual conversation, greeting, chitchat, or general question not matching any agent below
            - TASK: the user wants to perform an operation handled by one of these agents:
            %s

            Respond with ONLY one word: CHAT or TASK.
            """.formatted(agentDescriptions);
    }
}
