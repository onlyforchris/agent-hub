package com.efloow.agenthub.application.tool;

import com.efloow.agenthub.common.security.AccessControlService;
import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
public class ToolExecutor {

    private static final Logger log = LoggerFactory.getLogger(ToolExecutor.class);

    private final Map<String, ToolHandler> handlers;
    private final Map<String, ToolHandler> dynamicHandlers = new ConcurrentHashMap<>();
    private final ObjectProvider<AccessControlService> accessControlService;

    public ToolExecutor(List<ToolHandler> handlers) {
        this(handlers, null);
    }

    @Autowired
    public ToolExecutor(List<ToolHandler> handlers, ObjectProvider<AccessControlService> accessControlService) {
        this.handlers = handlers.stream()
                .collect(Collectors.toMap(ToolHandler::toolKey, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        this.accessControlService = accessControlService;
    }

    public void registerDynamicHandler(ToolHandler handler) {
        dynamicHandlers.put(handler.toolKey(), handler);
    }

    public void clearDynamicHandlers() {
        dynamicHandlers.clear();
    }

    public ToolResult invoke(String toolKey, Map<String, Object> params) {
        ToolHandler handler = resolveHandler(toolKey);
        if (handler == null) {
            log.warn("tool not found: toolKey={}", toolKey);
            return ToolResult.fail("T001_TOOL_NOT_FOUND", "Tool not found: " + toolKey);
        }
        long start = System.currentTimeMillis();
        try {
            ToolResult result = handler.invoke(params);
            long durationMs = System.currentTimeMillis() - start;
            log.info("tool invoke done: toolKey={}, success={}, durationMs={}",
                toolKey, result.success(), durationMs);
            return result;
        } catch (Exception e) {
            long durationMs = System.currentTimeMillis() - start;
            log.error("tool invoke failed: toolKey={}, durationMs={}", toolKey, durationMs, e);
            throw e;
        }
    }

    public ToolResult invoke(String toolKey, Map<String, Object> params, String permission) {
        ToolHandler handler = resolveHandler(toolKey);
        if (handler == null) {
            log.warn("tool not found: toolKey={}", toolKey);
            return ToolResult.fail("T001_TOOL_NOT_FOUND", "Tool not found: " + toolKey);
        }
        if (!hasRequestPermission(permission, handler.permission())) {
            log.warn("tool permission denied: toolKey={}, required={}, actual={}",
                toolKey, handler.permission(), permission);
            return ToolResult.fail("P001_PERMISSION_DENIED", "Permission denied for Tool: " + toolKey);
        }
        if (accessControlService != null) {
            accessControlService.ifAvailable(service -> service.assertPermission(handler.permission()));
        }
        long start = System.currentTimeMillis();
        try {
            ToolResult result = handler.invoke(params);
            long durationMs = System.currentTimeMillis() - start;
            log.info("tool invoke done: toolKey={}, success={}, durationMs={}",
                toolKey, result.success(), durationMs);
            return result;
        } catch (Exception e) {
            long durationMs = System.currentTimeMillis() - start;
            log.error("tool invoke failed: toolKey={}, durationMs={}", toolKey, durationMs, e);
            throw e;
        }
    }

    public List<Map<String, Object>> catalog() {
        return allHandlers().stream()
                .map(handler -> Map.of(
                        "toolKey", handler.toolKey(),
                        "description", handler.description(),
                        "permission", handler.permission(),
                        "inputSchema", handler.inputSchema()
                ))
                .toList();
    }

    private ToolHandler resolveHandler(String toolKey) {
        ToolHandler handler = handlers.get(toolKey);
        if (handler == null) {
            handler = dynamicHandlers.get(toolKey);
        }
        return handler;
    }

    private List<ToolHandler> allHandlers() {
        Map<String, ToolHandler> merged = new LinkedHashMap<>(handlers);
        dynamicHandlers.forEach(merged::putIfAbsent);
        return new ArrayList<>(merged.values());
    }

    private boolean hasRequestPermission(String actual, String required) {
        if (actual == null || actual.isBlank() || required == null || required.isBlank()) {
            return true;
        }
        return permissionRank(actual) >= permissionRank(required);
    }

    private int permissionRank(String permission) {
        String normalized = permission.trim().toUpperCase();
        if (normalized.startsWith("LEVEL_")) {
            return Integer.parseInt(normalized.substring("LEVEL_".length()));
        }
        return 0;
    }
}
