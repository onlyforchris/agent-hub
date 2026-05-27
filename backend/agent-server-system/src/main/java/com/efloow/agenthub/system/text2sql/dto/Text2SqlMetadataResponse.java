package com.efloow.agenthub.system.text2sql.dto;

import java.util.List;

/**
 * 元数据查询响应。
 */
public record Text2SqlMetadataResponse(List<Text2SqlTableMetaVo> tables) {
}
