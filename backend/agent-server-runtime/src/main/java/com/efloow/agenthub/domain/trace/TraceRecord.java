package com.efloow.agenthub.domain.trace;

import java.time.LocalDateTime;
import java.util.List;

public record TraceRecord(
        String traceId,
        String userId,
        String sessionId,
        String agentId,
        String skillKey,
        String inputSummary,
        LocalDateTime startTime,
        LocalDateTime endTime,
        List<TraceStep> steps
) {
}

