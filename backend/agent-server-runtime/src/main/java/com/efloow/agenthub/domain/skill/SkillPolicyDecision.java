package com.efloow.agenthub.domain.skill;

public record SkillPolicyDecision(
    boolean allowed,
    boolean requiresConfirm,
    String policySource,
    SkillAccessMode effectiveMode
) {
    public static SkillPolicyDecision deny(String source) {
        return new SkillPolicyDecision(false, false, source, SkillAccessMode.DENY);
    }

    public static SkillPolicyDecision allow(String source) {
        return new SkillPolicyDecision(true, false, source, SkillAccessMode.ALLOW);
    }

    public static SkillPolicyDecision confirm(String source) {
        return new SkillPolicyDecision(true, true, source, SkillAccessMode.ALLOW_WITH_CONFIRM);
    }
}
