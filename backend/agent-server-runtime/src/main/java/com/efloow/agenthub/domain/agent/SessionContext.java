package com.efloow.agenthub.domain.agent;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;

public class SessionContext {

    private final String userId;
    private final String sessionId;
    private final String agentId;
    private final String permission;
    private final Map<String, Object> variables;
    private final Map<String, Object> state = new LinkedHashMap<>();
    private Consumer<AgentStreamEvent> eventSink;

    public SessionContext(String userId, String sessionId, String agentId, String permission,
                          Map<String, Object> variables) {
        this.userId = userId;
        this.sessionId = sessionId;
        this.agentId = agentId;
        this.permission = permission;
        this.variables = variables != null ? Map.copyOf(variables) : Map.of();
    }

    public String userId() { return userId; }
    public String sessionId() { return sessionId; }
    public String agentId() { return agentId; }
    public String permission() { return permission; }
    public Map<String, Object> variables() { return variables; }

    public Object get(String key) { return state.get(key); }
    public void put(String key, Object value) { state.put(key, value); }
    public Map<String, Object> state() { return Map.copyOf(state); }

    public Consumer<AgentStreamEvent> eventSink() { return eventSink; }
    public void eventSink(Consumer<AgentStreamEvent> sink) { this.eventSink = sink; }

    public void emit(AgentStreamEvent event) {
        if (eventSink != null) {
            eventSink.accept(event);
        }
    }
}
