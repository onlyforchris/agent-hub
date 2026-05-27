package com.efloow.agenthub.domain.skill;

import java.util.List;
import java.util.Map;

public record SkillRuntimeView(
    String id,
    String skillCode,
    String skillName,
    String description,
    String version,
    String contentMd,
    List<String> paths,
    Map<String, Object> policy,
    String contextMode,
    boolean autoInvoke,
    boolean requireConfirm,
    String sideEffectLevel
) {
}
