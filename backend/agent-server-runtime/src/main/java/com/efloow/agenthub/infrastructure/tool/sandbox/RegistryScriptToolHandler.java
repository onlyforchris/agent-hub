package com.efloow.agenthub.infrastructure.tool.sandbox;

import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.system.entity.SystemToolRegistry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;

public class RegistryScriptToolHandler implements ToolHandler {

    private final SystemToolRegistry registry;
    private final ScriptSandboxService sandboxService;
    private final ObjectMapper objectMapper;

    public RegistryScriptToolHandler(
            SystemToolRegistry registry,
            ScriptSandboxService sandboxService,
            ObjectMapper objectMapper
    ) {
        this.registry = registry;
        this.sandboxService = sandboxService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String toolKey() {
        return registry.getToolKey();
    }

    @Override
    public String description() {
        return registry.getDescription() != null ? registry.getDescription() : registry.getToolName();
    }

    @Override
    public String permission() {
        String code = registry.getPermissionCode();
        return code != null && !code.isBlank() ? code : "LEVEL_1";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return parseSchema(registry.getInputSchema());
    }

    @Override
    @SuppressWarnings("unchecked")
    public ToolResult invoke(Map<String, Object> params) {
        Map<String, Object> bindings = resolveBindings(params);
        String script = registry.getScriptContent();
        Object result = sandboxService.evalScript(script, bindings);
        return ToolResult.ok(result);
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

    private Map<String, Object> parseSchema(String json) {
        if (json == null || json.isBlank()) {
            return Map.of("type", "object");
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of("type", "object");
        }
    }
}
