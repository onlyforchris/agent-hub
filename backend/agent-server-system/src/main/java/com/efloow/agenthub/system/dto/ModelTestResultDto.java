package com.efloow.agenthub.system.dto;

public record ModelTestResultDto(
        boolean success,
        int latencyMs,
        String message,
        String modelUsed
) {
}
