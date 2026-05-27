package com.efloow.agenthub.domain.agent;

public record ConfirmResponse(
    String confirmId,
    boolean approved,
    String comment
) {}
