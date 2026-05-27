package com.efloow.agenthub.system.controller;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.dto.ModelMonitorSummaryDto;
import com.efloow.agenthub.system.dto.PageResult;
import com.efloow.agenthub.system.entity.AuditLog;
import com.efloow.agenthub.system.entity.ConversationRecord;
import com.efloow.agenthub.system.entity.ExecutionTrace;
import com.efloow.agenthub.system.service.ModelMonitorService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rbac/model-monitor")
public class ModelMonitorController {

    private final ModelMonitorService modelMonitorService;

    public ModelMonitorController(ModelMonitorService modelMonitorService) {
        this.modelMonitorService = modelMonitorService;
    }

    @GetMapping("/summary")
    public R<ModelMonitorSummaryDto> summary() {
        return R.ok(modelMonitorService.summary());
    }

    @GetMapping("/token-trend")
    public R<List<Map<String, Object>>> tokenTrend(
            @RequestParam(defaultValue = "7") int days
    ) {
        return R.ok(modelMonitorService.dailyTokenTrend(days));
    }

    @GetMapping("/llm-calls")
    public R<PageResult<AuditLog>> llmCalls(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String model,
            @RequestParam(required = false) Integer status
    ) {
        return R.ok(modelMonitorService.listLlmCalls(page, pageSize, provider, model, status));
    }

    @GetMapping("/conversations")
    public R<PageResult<Map<String, Object>>> conversations(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String agentId
    ) {
        return R.ok(modelMonitorService.listConversationSessions(page, pageSize, sessionId, agentId));
    }

    @GetMapping("/conversations/{sessionId}")
    public R<List<ConversationRecord>> conversationDetail(@PathVariable String sessionId) {
        return R.ok(modelMonitorService.conversationTurns(sessionId));
    }

    @GetMapping("/traces")
    public R<PageResult<ExecutionTrace>> traces(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String agentId,
            @RequestParam(required = false) Integer status
    ) {
        return R.ok(modelMonitorService.listTraces(page, pageSize, agentId, status));
    }
}
