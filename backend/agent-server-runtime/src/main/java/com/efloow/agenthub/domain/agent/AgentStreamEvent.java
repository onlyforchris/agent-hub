package com.efloow.agenthub.domain.agent;

import java.util.List;
import java.util.Map;

public record AgentStreamEvent(
    String type,
    String message,
    Map<String, Object> payload,
    Long startedAt,
    Long endedAt,
    Long durationMs
) {

    public AgentStreamEvent(String type, String message, Map<String, Object> payload) {
        this(type, message, payload, null, null, null);
    }

    public AgentStreamEvent withTiming(Long startedAt, Long endedAt, Long durationMs) {
        return new AgentStreamEvent(type, message, payload, startedAt, endedAt, durationMs);
    }

    public static AgentStreamEvent step(String type, String message) {
        return new AgentStreamEvent("step", message, Map.of("type", type));
    }

    public static AgentStreamEvent step(String type, String message, Map<String, Object> payload) {
        return new AgentStreamEvent("step", message, payload);
    }

    public static AgentStreamEvent token(String text) {
        return new AgentStreamEvent("token", text, Map.of());
    }

    public static AgentStreamEvent complete(AgentResult result) {
        return new AgentStreamEvent("complete", result.reply(),
            Map.of("result", result));
    }

    public static AgentStreamEvent error(String message) {
        return new AgentStreamEvent("error", message, Map.of());
    }

    public static AgentStreamEvent thought(String thought) {
        return new AgentStreamEvent("thought", thought, Map.of());
    }

    public static AgentStreamEvent plan(List<String> steps) {
        return new AgentStreamEvent("plan", "Agent 规划了 " + steps.size() + " 个执行步骤",
            Map.of("steps", steps));
    }

    public static AgentStreamEvent confirmRequest(ConfirmRequest req) {
        return new AgentStreamEvent("confirm_request", req.description(),
            Map.of("confirmId", req.confirmId(),
                "action", req.action(),
                "riskLevel", req.riskLevel().name(),
                "detail", req.detail()));
    }

    public static AgentStreamEvent confirmed(String confirmId) {
        return new AgentStreamEvent("confirmed", "用户已确认", Map.of("confirmId", confirmId));
    }

    public static AgentStreamEvent cancelled(String confirmId) {
        return new AgentStreamEvent("cancelled", "用户取消了操作", Map.of("confirmId", confirmId));
    }
}
