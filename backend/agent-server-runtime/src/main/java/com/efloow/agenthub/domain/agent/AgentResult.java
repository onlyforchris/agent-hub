package com.efloow.agenthub.domain.agent;

import com.efloow.agenthub.domain.trace.TraceRecord;

import java.util.List;
import java.util.Map;

public record AgentResult(
    String reply,
    Map<String, Object> data,
    List<ClientAction> actions,
    String agentId,
    String traceId,
    TraceRecord trace
) {

    public record ClientAction(String type, String label, String url) {}

    public static AgentResult of(String reply, Map<String, Object> data) {
        return new AgentResult(reply, data, List.of(), null, null, null);
    }

    public static AgentResult of(String reply, Map<String, Object> data, List<ClientAction> actions) {
        return new AgentResult(reply, data, actions, null, null, null);
    }
}
