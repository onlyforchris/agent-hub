package com.efloow.agenthub.system.text2sql.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 不落库的连通性测试请求。
 */
public record Text2SqlConnectionProbeRequest(
    @NotBlank @Size(max = 32) String dbType,
    @NotBlank @Size(max = 256) String host,
    @Min(1) @Max(65535) int port,
    @NotBlank @Size(max = 128) String databaseName,
    @NotBlank @Size(max = 128) String username,
    @NotBlank @Size(max = 512) String password,
    @Size(max = 512) String jdbcParams
) {
}
