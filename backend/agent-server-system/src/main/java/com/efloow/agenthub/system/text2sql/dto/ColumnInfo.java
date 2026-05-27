package com.efloow.agenthub.system.text2sql.dto;

import java.util.List;

/**
 * 列结构信息。
 */
public record ColumnInfo(
    String name,
    String dataType,
    String columnType,
    boolean nullable,
    boolean primaryKey,
    String comment,
    List<String> sampleValues
) {
}
