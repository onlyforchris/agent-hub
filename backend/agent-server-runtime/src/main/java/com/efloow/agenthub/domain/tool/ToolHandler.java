package com.efloow.agenthub.domain.tool;

import java.util.Map;

public interface ToolHandler {

    String toolKey();

    default String description() {
        return toolKey();
    }

    default String permission() {
        return "LEVEL_1";
    }

    Map<String, Object> inputSchema();

    ToolResult invoke(Map<String, Object> params);
}
