package com.efloow.agenthub.system.text2sql.dto;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 语义检索结果上下文，用于 Prompt 组装。
 */
public record RetrievalContext(
    List<ScoredTable> candidateTables,
    List<ScoredColumn> candidateColumns,
    List<String> expandedTableNames,
    List<ForeignKeyInfo> foreignKeys
) {

    public Set<String> allTableNames() {
        Set<String> set = new LinkedHashSet<>();
        for (ScoredTable t : candidateTables) {
            set.add(t.tableName());
        }
        set.addAll(expandedTableNames);
        return set;
    }

    public record ScoredTable(String tableName, String chunkText, double similarity) {}
    public record ScoredColumn(String tableName, String columnName, String chunkText, double similarity) {}
}
