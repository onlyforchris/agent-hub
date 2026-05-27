package com.efloow.agenthub.system.text2sql.dto;

/**
 * 数据源连接列表或详情 VO（不含密码）。
 */
public record Text2SqlConnectionVo(
    String id,
    String displayName,
    String dbType,
    String host,
    int port,
    String databaseName,
    String username,
    boolean passwordConfigured,
    String jdbcParams,
    String remark,
    String createBy,
    String createTime,
    String updateTime
) {
}
