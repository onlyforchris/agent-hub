package com.efloow.agenthub.domain.tool;

public record ToolResult(boolean success, Object data, String errorCode, String errorMessage) {

    /**
     * Builds a successful Tool result.
     *
     * @param data structured output
     * @return tool result
     */
    public static ToolResult ok(Object data) {
        return new ToolResult(true, data, null, null);
    }

    /**
     * Builds a failed Tool result.
     *
     * @param errorCode stable error code
     * @param errorMessage user readable message
     * @return tool result
     */
    public static ToolResult fail(String errorCode, String errorMessage) {
        return new ToolResult(false, null, errorCode, errorMessage);
    }
}

