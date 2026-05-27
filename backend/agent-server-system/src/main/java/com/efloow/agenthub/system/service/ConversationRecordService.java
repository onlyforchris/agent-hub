package com.efloow.agenthub.system.service;

import com.efloow.agenthub.system.entity.ConversationRecord;
import com.efloow.agenthub.system.mapper.ConversationRecordMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ConversationRecordService {

    private static final Logger log = LoggerFactory.getLogger(ConversationRecordService.class);

    private final ConversationRecordMapper mapper;

    public ConversationRecordService(ConversationRecordMapper mapper) {
        this.mapper = mapper;
    }

    public void appendTurn(String sessionId, String turnId, String userInput, String agentReply, String agentId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        try {
            ConversationRecord row = new ConversationRecord();
            row.setId(UUID.randomUUID().toString());
            row.setSessionId(sessionId);
            row.setTurnId(turnId != null ? turnId : "");
            row.setUserId(MDC.get("userId"));
            row.setAgentId(agentId != null ? agentId : "");
            row.setUserInput(truncate(userInput, 4000));
            row.setAgentReply(truncate(agentReply, 8000));
            row.setSummary(truncate(userInput, 120));
            row.setStatus(1);
            row.setCreateBy(MDC.get("userId"));
            mapper.insert(row);
        } catch (Exception e) {
            log.warn("persist conversation turn failed: sessionId={}, err={}", sessionId, e.getMessage());
        }
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
