package com.efloow.agenthub.domain.trace;

public record TraceStep(
        String stepId,
        String type,
        String status,
        long durationMs,
        Object inputSummary,
        Object outputSummary,
        String errorCode,
        String errorMessage
) {
}

