package com.efloow.agenthub.system.text2sql.dto;

public record Text2SqlTermVo(
    String id,
    String connectionId,
    String term,
    String termType,
    String tableName,
    String columnName,
    String formula,
    String filterCondition,
    Integer priority,
    Integer status,
    String remark,
    String createBy,
    String createTime,
    String updateBy,
    String updateTime
) {}
