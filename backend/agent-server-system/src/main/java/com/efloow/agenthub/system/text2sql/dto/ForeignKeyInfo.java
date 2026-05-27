package com.efloow.agenthub.system.text2sql.dto;

/**
 * 外键关系。
 */
public record ForeignKeyInfo(
    String constraintName,
    String fromTable,
    String fromColumn,
    String toTable,
    String toColumn
) {
}
