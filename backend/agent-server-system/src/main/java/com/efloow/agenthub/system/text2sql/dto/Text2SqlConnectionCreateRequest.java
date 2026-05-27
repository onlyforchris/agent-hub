package com.efloow.agenthub.system.text2sql.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 新建数据源连接请求体。
 *
 * @param displayName 显示名称
 * @param dbType      当前仅支持 MYSQL
 * @param host        主机
 * @param port        端口
 * @param databaseName 库名
 * @param username    用户名
 * @param password    明文密码（写入前 AES 加密）
 * @param jdbcParams  可选 JDBC 查询串片段
 * @param remark      备注
 */
public record Text2SqlConnectionCreateRequest(
    @NotBlank @Size(max = 200) String displayName,
    @NotBlank @Size(max = 32) String dbType,
    @NotBlank @Size(max = 256) String host,
    @Min(1) @Max(65535) int port,
    @NotBlank @Size(max = 128) String databaseName,
    @NotBlank @Size(max = 128) String username,
    @NotBlank @Size(max = 512) String password,
    @Size(max = 512) String jdbcParams,
    @Size(max = 500) String remark
) {
}
