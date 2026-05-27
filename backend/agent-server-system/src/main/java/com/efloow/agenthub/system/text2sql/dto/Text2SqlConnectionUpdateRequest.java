package com.efloow.agenthub.system.text2sql.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * 更新数据源连接请求体；密码为空表示不修改已存密码。
 */
public record Text2SqlConnectionUpdateRequest(
    @Size(max = 200) String displayName,
    @Size(max = 256) String host,
    @Min(1) @Max(65535) Integer port,
    @Size(max = 128) String databaseName,
    @Size(max = 128) String username,
    @Size(max = 512) String password,
    @Size(max = 512) String jdbcParams,
    @Size(max = 500) String remark
) {
}
