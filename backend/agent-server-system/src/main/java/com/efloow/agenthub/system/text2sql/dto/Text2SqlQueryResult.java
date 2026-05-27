package com.efloow.agenthub.system.text2sql.dto;

import java.util.List;

/**
 * Text2SQL 查询执行结果。
 */
public record Text2SqlQueryResult(
    String question,
    String sql,
    List<String> columns,
    List<List<String>> rows,
    int rowCount,
    long executionMs,
    String chartSuggestion
) {}
