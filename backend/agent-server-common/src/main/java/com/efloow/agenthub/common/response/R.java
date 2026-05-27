package com.efloow.agenthub.common.response;

import java.util.UUID;
import org.slf4j.MDC;

public record R<T>(boolean success, String traceId, String code, String message, T data) {

    public static <T> R<T> ok(T data) {
        return new R<>(true, resolveTraceId(), "OK", "success", data);
    }

    public static <T> R<T> fail(String code, String message) {
        return new R<>(false, resolveTraceId(), code, message, null);
    }

    private static String resolveTraceId() {
        String traceId = MDC.get("traceId");
        if (traceId == null || traceId.isBlank()) {
            return UUID.randomUUID().toString();
        }
        return traceId;
    }
}

