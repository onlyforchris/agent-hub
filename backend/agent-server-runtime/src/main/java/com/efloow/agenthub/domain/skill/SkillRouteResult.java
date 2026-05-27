package com.efloow.agenthub.domain.skill;

public record SkillRouteResult(
    String skillCode,
    SkillRuntimeView skill,
    String reason,
    String matchedBy,
    double score
) {
}
