package com.efloow.agenthub.domain.agent;

import com.efloow.agenthub.domain.tool.ToolHandler;
import java.util.Map;

public record ToolDef(
    String toolKey,
    String description,
    ConfirmRequest.RiskLevel riskLevel,
    Map<String, Object> inputSchema
) {
    public static ToolDef from(ToolHandler handler, ConfirmRequest.RiskLevel riskLevel) {
        return new ToolDef(
            handler.toolKey(),
            handler.description(),
            riskLevel,
            handler.inputSchema()
        );
    }

    public String toPromptFormat() {
        StringBuilder sb = new StringBuilder();
        sb.append("- ").append(toolKey).append(": ").append(description).append("\n");
        sb.append("  参数: ").append(inputSchema).append("\n");
        sb.append("  风险: ").append(riskLevel).append("\n");
        return sb.toString();
    }
}
