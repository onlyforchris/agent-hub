package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class SkillSessionHolder {

    private static final ThreadLocal<SkillRuntimeView> CURRENT = new ThreadLocal<>();
    private static final ThreadLocal<Map<String, SkillConfirmAuditService.PendingSkillConfirm>> PENDING =
        ThreadLocal.withInitial(ConcurrentHashMap::new);

    public void bind(SkillRuntimeView skill) {
        CURRENT.set(skill);
    }

    public SkillRuntimeView currentSkill() {
        return CURRENT.get();
    }

    public void registerPending(SkillConfirmAuditService.PendingSkillConfirm pending) {
        PENDING.get().put(pending.confirmId(), pending);
    }

    public SkillConfirmAuditService.PendingSkillConfirm pendingConfirm(String confirmId) {
        return PENDING.get().get(confirmId);
    }

    public void clear() {
        CURRENT.remove();
        PENDING.remove();
    }
}
