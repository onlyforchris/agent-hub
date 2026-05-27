package com.efloow.agenthub.common.response;

public record AgentResponse<T>(
        boolean success,
        String traceId,
        String code,
        String message,
        T data
) {

    /**
     * Builds a successful Agent response with trace semantics.
     *
     * @param traceId orchestration trace id
     * @param data response payload
     * @return wrapped response
     */
    public static <T> AgentResponse<T> ok(String traceId, T data) {
        return new AgentResponse<>(true, traceId, "OK", "success", data);
    }

    /**
     * Builds a failed Agent response with trace semantics.
     *
     * @param traceId orchestration trace id
     * @param code stable error code
     * @param message user readable message
     * @return wrapped response
     */
    public static <T> AgentResponse<T> fail(String traceId, String code, String message) {
        return new AgentResponse<>(false, traceId, code, message, null);
    }
}

