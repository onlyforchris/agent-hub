package com.efloow.agenthub.infrastructure.tool.sandbox;

import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class ScriptSandboxTool implements ToolHandler {

    private final ScriptSandboxService sandboxService;

    public ScriptSandboxTool(ScriptSandboxService sandboxService) {
        this.sandboxService = sandboxService;
    }

    @Override
    public String toolKey() {
        return "sandbox.script.eval";
    }

    @Override
    public String description() {
        return "在受限 Groovy 沙箱中执行脚本（平台唯一脚本运行时）";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "script", Map.of("type", "string"),
                        "bindings", Map.of("type", "object")
                ),
                "required", List.of("script")
        );
    }

    @Override
    @SuppressWarnings("unchecked")
    public ToolResult invoke(Map<String, Object> params) {
        String script = stringParam(params, "script");
        Map<String, Object> bindings = resolveBindings(params);
        Object result = sandboxService.evalScript(script, bindings);
        return ToolResult.ok(Map.of("result", result));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveBindings(Map<String, Object> params) {
        if (params == null || params.isEmpty()) {
            return Map.of();
        }
        if (params.get("bindings") instanceof Map<?, ?> nested) {
            return (Map<String, Object>) nested;
        }
        return params;
    }

    private String stringParam(Map<String, Object> params, String key) {
        Object value = params != null ? params.get(key) : null;
        return value == null ? "" : value.toString();
    }
}
