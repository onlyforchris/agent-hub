package com.efloow.agenthub.infrastructure.tool.cli;

public record CliProcessResult(
        int exitCode,
        String stdout,
        String stderr,
        long durationMs
) {}
