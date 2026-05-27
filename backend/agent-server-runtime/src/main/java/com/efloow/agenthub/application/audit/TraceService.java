package com.efloow.agenthub.application.audit;

import com.efloow.agenthub.domain.trace.TraceRecord;
import com.efloow.agenthub.domain.trace.TraceStep;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class TraceService {

    private static final Logger log = LoggerFactory.getLogger(TraceService.class);

    private final ObjectMapper objectMapper;

    public TraceService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void record(TraceRecord trace) {
        try {
            String summary = objectMapper.writeValueAsString(Map.of(
                "traceId", trace.traceId(),
                "userId", trace.userId(),
                "sessionId", trace.sessionId(),
                "agentId", trace.agentId(),
                "skillKey", trace.skillKey(),
                "inputSummary", trace.inputSummary(),
                "startTime", trace.startTime() != null ? trace.startTime().toString() : null,
                "endTime", trace.endTime() != null ? trace.endTime().toString() : null,
                "stepCount", trace.steps() != null ? trace.steps().size() : 0
            ));
            log.info("audit action=agent_execution trace={}", summary);
        } catch (Exception e) {
            log.warn("Failed to serialize trace record: {}", e.getMessage());
        }
    }

    public void recordAction(String action, Map<String, Object> detail) {
        log.info("audit action={} detail={}", action, detail);
    }

    public void recordStep(String traceId, TraceStep step) {
        log.info("audit action=step_execution traceId={} stepId={} type={} status={} durationMs={}",
            traceId, step.stepId(), step.type(), step.status(), step.durationMs());
    }
}
