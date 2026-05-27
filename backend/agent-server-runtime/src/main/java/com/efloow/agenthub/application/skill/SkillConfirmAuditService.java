package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import com.efloow.agenthub.system.entity.SystemSkillConfirmAudit;
import com.efloow.agenthub.system.mapper.SystemSkillConfirmAuditMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

@Service
public class SkillConfirmAuditService {

    private static final Logger log = LoggerFactory.getLogger(SkillConfirmAuditService.class);

    private final SystemSkillConfirmAuditMapper auditMapper;
    private final ObjectMapper objectMapper;
    private final SkillSessionHolder sessionHolder;

    public SkillConfirmAuditService(
            SystemSkillConfirmAuditMapper auditMapper,
            ObjectMapper objectMapper,
            SkillSessionHolder sessionHolder
    ) {
        this.auditMapper = auditMapper;
        this.objectMapper = objectMapper;
        this.sessionHolder = sessionHolder;
    }

    public void recordDecision(
            String sessionId,
            String confirmId,
            boolean approved,
            String comment
    ) {
        SkillRuntimeView skill = sessionHolder.currentSkill();
        if (skill == null) {
            return;
        }
        PendingSkillConfirm pending = sessionHolder.pendingConfirm(confirmId);
        if (pending == null) {
            return;
        }
        SystemSkillConfirmAudit row = new SystemSkillConfirmAudit();
        row.setId(UUID.randomUUID().toString());
        row.setTraceId(MDC.get("traceId"));
        row.setSessionId(sessionId);
        row.setUserId(MDC.get("userId"));
        row.setSkillCode(skill.skillCode());
        row.setSkillVersion(skill.version());
        row.setConfirmId(confirmId);
        row.setActionType(pending.actionType());
        row.setActionFingerprint(pending.actionFingerprint());
        row.setRiskLevel(pending.riskLevel());
        row.setPolicySnapshot(toJson(skill.policy()));
        row.setConfirmPayload(toJson(pending.payload()));
        row.setDecision(approved ? "approved" : "denied");
        row.setDecisionComment(comment);
        row.setDecidedAt(LocalDateTime.now());
        row.setStatus(1);
        row.setCreateBy(MDC.get("userId"));
        auditMapper.insert(row);
        log.info("Skill 确认审计: skillCode={}, confirmId={}, decision={}",
            skill.skillCode(), confirmId, row.getDecision());
    }

    public void registerPending(PendingSkillConfirm pending) {
        sessionHolder.registerPending(pending);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    public record PendingSkillConfirm(
        String confirmId,
        String actionType,
        String actionFingerprint,
        String riskLevel,
        Map<String, Object> payload
    ) {
    }
}
