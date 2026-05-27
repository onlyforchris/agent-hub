package com.efloow.agenthub.system.dto;

import java.util.List;
import java.util.Map;

public record ModelMonitorSummaryDto(
        long llmCallCountToday,
        long inputTokensToday,
        long outputTokensToday,
        long failedCallsToday,
        long activeProviders,
        long conversationSessions,
        List<Map<String, Object>> tokensByProvider
) {
}
