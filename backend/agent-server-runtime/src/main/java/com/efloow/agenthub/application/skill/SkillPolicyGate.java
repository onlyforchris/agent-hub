package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.domain.skill.SkillAccessMode;
import com.efloow.agenthub.domain.skill.SkillActionType;
import com.efloow.agenthub.domain.skill.SkillPolicyDecision;
import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class SkillPolicyGate {

    public SkillPolicyDecision evaluate(SkillRuntimeView skill, SkillActionType actionType) {
        if (skill == null) {
            return SkillPolicyDecision.allow("platform.default");
        }
        if (!skill.requireConfirm()) {
            return SkillPolicyDecision.allow("skill.require_confirm=false");
        }
        Map<String, Object> policy = skill.policy();
        String sectionKey = switch (actionType) {
            case NETWORK -> "network";
            case FILESYSTEM_WRITE -> "filesystem_write";
            case SCRIPT -> "scripts";
            case TOOL -> "tools";
        };
        SkillAccessMode mode = resolveMode(policy, sectionKey, actionType);
        String source = "skill.policy_json." + sectionKey;
        return switch (mode) {
            case DENY -> SkillPolicyDecision.deny(source);
            case ALLOW -> SkillPolicyDecision.allow(source);
            case ALLOW_WITH_CONFIRM -> SkillPolicyDecision.confirm(source);
        };
    }

    @SuppressWarnings("unchecked")
    private SkillAccessMode resolveMode(Map<String, Object> policy, String sectionKey, SkillActionType actionType) {
        if (actionType == SkillActionType.TOOL) {
            Object tools = policy.get("tools");
            if (tools instanceof Map<?, ?> toolsMap) {
                Object mode = toolsMap.get("mode");
                if ("denylist".equals(String.valueOf(mode)) || "allowlist".equals(String.valueOf(mode))) {
                    return SkillAccessMode.ALLOW_WITH_CONFIRM;
                }
            }
        }
        Object section = policy.get(sectionKey);
        if (!(section instanceof Map<?, ?> sectionMap)) {
            return SkillAccessMode.ALLOW_WITH_CONFIRM;
        }
        Object mode = sectionMap.get("mode");
        if (mode == null) {
            return SkillAccessMode.ALLOW_WITH_CONFIRM;
        }
        try {
            return SkillAccessMode.valueOf(String.valueOf(mode).trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return SkillAccessMode.ALLOW_WITH_CONFIRM;
        }
    }
}
