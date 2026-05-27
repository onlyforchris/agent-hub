package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.efloow.agenthub.system.dto.ModelMonitorSummaryDto;
import com.efloow.agenthub.system.dto.PageResult;
import com.efloow.agenthub.system.entity.AuditLog;
import com.efloow.agenthub.system.entity.ConversationRecord;
import com.efloow.agenthub.system.entity.ExecutionTrace;
import com.efloow.agenthub.system.entity.SystemModelProvider;
import com.efloow.agenthub.system.mapper.AuditLogMapper;
import com.efloow.agenthub.system.mapper.ConversationRecordMapper;
import com.efloow.agenthub.system.mapper.ExecutionTraceMapper;
import com.efloow.agenthub.system.mapper.SystemModelProviderMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ModelMonitorService {

    private final AuditLogMapper auditLogMapper;
    private final ConversationRecordMapper conversationRecordMapper;
    private final ExecutionTraceMapper executionTraceMapper;
    private final SystemModelProviderMapper modelProviderMapper;
    private final RbacService rbacService;

    public ModelMonitorService(
            AuditLogMapper auditLogMapper,
            ConversationRecordMapper conversationRecordMapper,
            ExecutionTraceMapper executionTraceMapper,
            SystemModelProviderMapper modelProviderMapper,
            RbacService rbacService
    ) {
        this.auditLogMapper = auditLogMapper;
        this.conversationRecordMapper = conversationRecordMapper;
        this.executionTraceMapper = executionTraceMapper;
        this.modelProviderMapper = modelProviderMapper;
        this.rbacService = rbacService;
    }

    public ModelMonitorSummaryDto summary() {
        rbacService.assertPermission("system:model-monitor:view");
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        Map<String, Object> agg = auditLogMapper.aggregateLlmSince(startOfDay);
        long callCount = numberValue(agg.get("call_count"));
        long inputTokens = numberValue(agg.get("input_tokens"));
        long outputTokens = numberValue(agg.get("output_tokens"));
        long failed = numberValue(agg.get("failed_count"));

        long providers = modelProviderMapper.selectCount(
                new LambdaQueryWrapper<SystemModelProvider>()
                        .ne(SystemModelProvider::getStatus, 2)
                        .eq(SystemModelProvider::getIsEnabled, 1)
        );
        long sessions = conversationRecordMapper.countDistinctSessions(null, null);

        return new ModelMonitorSummaryDto(
                callCount,
                inputTokens,
                outputTokens,
                failed,
                providers,
                sessions,
                auditLogMapper.tokensByProviderSince(startOfDay)
        );
    }

    public PageResult<AuditLog> listLlmCalls(int page, int pageSize, String provider, String model, Integer status) {
        rbacService.assertPermission("system:model-monitor:view");
        LambdaQueryWrapper<AuditLog> wrapper = new LambdaQueryWrapper<AuditLog>()
                .eq(AuditLog::getActionType, "LLM_CALL")
                .orderByDesc(AuditLog::getCreateTime);
        if (StringUtils.hasText(provider)) {
            wrapper.eq(AuditLog::getModelProvider, provider);
        }
        if (StringUtils.hasText(model)) {
            wrapper.eq(AuditLog::getModelName, model);
        }
        if (status != null) {
            wrapper.eq(AuditLog::getStatus, status);
        }
        Page<AuditLog> result = auditLogMapper.selectPage(new Page<>(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), page, pageSize, result.getRecords());
    }

    public PageResult<Map<String, Object>> listConversationSessions(
            int page, int pageSize, String sessionId, String agentId
    ) {
        rbacService.assertPermission("system:model-monitor:view");
        int offset = Math.max(0, (page - 1) * pageSize);
        long total = conversationRecordMapper.countDistinctSessions(
                blankToNull(sessionId), blankToNull(agentId));
        List<Map<String, Object>> records = conversationRecordMapper.listSessionSummaries(
                blankToNull(sessionId), blankToNull(agentId), pageSize, offset);
        return new PageResult<>(total, page, pageSize, records);
    }

    public List<ConversationRecord> conversationTurns(String sessionId) {
        rbacService.assertPermission("system:model-monitor:view");
        return conversationRecordMapper.selectList(
                new LambdaQueryWrapper<ConversationRecord>()
                        .eq(ConversationRecord::getSessionId, sessionId)
                        .orderByAsc(ConversationRecord::getCreateTime)
        );
    }

    public PageResult<ExecutionTrace> listTraces(int page, int pageSize, String agentId, Integer status) {
        rbacService.assertPermission("system:model-monitor:view");
        LambdaQueryWrapper<ExecutionTrace> wrapper = new LambdaQueryWrapper<ExecutionTrace>()
                .orderByDesc(ExecutionTrace::getStartedAt);
        if (StringUtils.hasText(agentId)) {
            wrapper.eq(ExecutionTrace::getAgentId, agentId);
        }
        if (status != null) {
            wrapper.eq(ExecutionTrace::getStatus, status);
        }
        Page<ExecutionTrace> result = executionTraceMapper.selectPage(new Page<>(page, pageSize), wrapper);
        return new PageResult<>(result.getTotal(), page, pageSize, result.getRecords());
    }

    public List<Map<String, Object>> dailyTokenTrend(int days) {
        rbacService.assertPermission("system:model-monitor:view");
        LocalDateTime since = LocalDate.now().minusDays(days - 1L).atStartOfDay();
        List<AuditLog> rows = auditLogMapper.selectList(
                new LambdaQueryWrapper<AuditLog>()
                        .eq(AuditLog::getActionType, "LLM_CALL")
                        .ge(AuditLog::getCreateTime, since)
                        .orderByAsc(AuditLog::getCreateTime)
        );
        Map<String, long[]> byDay = new LinkedHashMap<>();
        for (AuditLog row : rows) {
            if (row.getCreateTime() == null) {
                continue;
            }
            String day = row.getCreateTime().toLocalDate().toString();
            long[] bucket = byDay.computeIfAbsent(day, ignored -> new long[3]);
            bucket[0] += row.getInputTokens() != null ? row.getInputTokens() : 0;
            bucket[1] += row.getOutputTokens() != null ? row.getOutputTokens() : 0;
            bucket[2] += 1;
        }
        return byDay.entrySet().stream()
                .map(e -> Map.<String, Object>of(
                        "date", e.getKey(),
                        "inputTokens", e.getValue()[0],
                        "outputTokens", e.getValue()[1],
                        "callCount", e.getValue()[2]
                ))
                .toList();
    }

    private long numberValue(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
