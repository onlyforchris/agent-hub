package com.efloow.agenthub.system.service;

import com.efloow.agenthub.system.entity.AuditLog;
import com.efloow.agenthub.system.mapper.AuditLogMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;

@Service
public class LlmAuditService {

    private static final Logger log = LoggerFactory.getLogger(LlmAuditService.class);

    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public LlmAuditService(AuditLogMapper auditLogMapper, ObjectMapper objectMapper) {
        this.auditLogMapper = auditLogMapper;
        this.objectMapper = objectMapper;
    }

    public void recordLlmCall(
            String provider,
            String model,
            int inputTokens,
            int outputTokens,
            long durationMs,
            boolean success,
            String errorMessage,
            Map<String, Object> payloadExtra
    ) {
        try {
            AuditLog row = new AuditLog();
            row.setId(UUID.randomUUID().toString());
            row.setTraceId(MDC.get("traceId"));
            row.setSessionId(MDC.get("sessionId"));
            row.setUserId(MDC.get("userId"));
            row.setAgentId(MDC.get("agentId"));
            row.setActionType("LLM_CALL");
            row.setAction(provider + ".chat");
            row.setTarget(model);
            row.setModelProvider(provider);
            row.setModelName(model);
            row.setInputTokens(inputTokens);
            row.setOutputTokens(outputTokens);
            LocalDateTime end = LocalDateTime.now();
            row.setEndTime(end);
            row.setStartTime(end.minus(Math.max(durationMs, 0), ChronoUnit.MILLIS));
            row.setDurationMs((int) Math.min(durationMs, Integer.MAX_VALUE));
            row.setStatus(success ? 1 : 0);
            if (!success && errorMessage != null) {
                row.setErrorMessage(truncate(errorMessage, 500));
            }
            row.setPayload(serializePayload(payloadExtra));
            row.setCreateBy(MDC.get("userId"));
            auditLogMapper.insert(row);
        } catch (Exception e) {
            log.warn("persist llm audit failed: {}", e.getMessage());
        }
    }

    private String serializePayload(Map<String, Object> extra) {
        try {
            if (extra == null || extra.isEmpty()) {
                return "{}";
            }
            return objectMapper.writeValueAsString(extra);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
