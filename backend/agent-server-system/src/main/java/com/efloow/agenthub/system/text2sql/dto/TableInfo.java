package com.efloow.agenthub.system.text2sql.dto;

import java.util.List;

/**
 * 表结构信息。
 */
public record TableInfo(
    String tableName,
    String tableComment,
    long rowEstimate,
    List<ColumnInfo> columns,
    List<List<String>> sampleRows
) {
}
