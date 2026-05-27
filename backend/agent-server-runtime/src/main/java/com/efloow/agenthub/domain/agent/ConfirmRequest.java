package com.efloow.agenthub.domain.agent;

import java.util.Map;

public record ConfirmRequest(
    String confirmId,
    String sessionId,
    String action,
    String description,
    RiskLevel riskLevel,
    Map<String, Object> detail
) {
    public enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }

    public boolean requiresConfirmation() {
        return riskLevel == RiskLevel.HIGH || riskLevel == RiskLevel.CRITICAL;
    }
}
