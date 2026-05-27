package com.efloow.agenthub.system.text2sql.dto;

/**
 * information_schema 拉取的表清单项。
 */
public record Text2SqlTableMetaVo(String tableName, String tableType) {
}
