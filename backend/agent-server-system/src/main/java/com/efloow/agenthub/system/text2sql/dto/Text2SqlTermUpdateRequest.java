package com.efloow.agenthub.system.text2sql.dto;

import jakarta.validation.constraints.NotBlank;

public record Text2SqlTermUpdateRequest(
    String connectionId,
    @NotBlank String term,
    @NotBlank String termType,
    String tableName,
    String columnName,
    String formula,
    String filterCondition,
    Integer priority
) {}
