package com.efloow.agenthub.system.text2sql.dto;

import java.util.List;

/**
 * Schema 快照，包含表结构与外键关系。
 */
public record SchemaSnapshot(List<TableInfo> tables, List<ForeignKeyInfo> foreignKeys) {
}
