package com.efloow.agenthub.infrastructure.tool.sandbox;

import com.efloow.agenthub.application.tool.ToolExecutor;
import com.efloow.agenthub.system.entity.SystemToolRegistry;
import com.efloow.agenthub.system.service.ToolRegistryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class ToolRegistrySync {

    private static final Logger log = LoggerFactory.getLogger(ToolRegistrySync.class);

    private final ToolRegistryService toolRegistryService;
    private final ToolExecutor toolExecutor;
    private final ScriptSandboxService sandboxService;
    private final ObjectMapper objectMapper;

    public ToolRegistrySync(
            ToolRegistryService toolRegistryService,
            ToolExecutor toolExecutor,
            ScriptSandboxService sandboxService,
            ObjectMapper objectMapper
    ) {
        this.toolRegistryService = toolRegistryService;
        this.toolExecutor = toolExecutor;
        this.sandboxService = sandboxService;
        this.objectMapper = objectMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        reload();
    }

    public void reload() {
        toolExecutor.clearDynamicHandlers();
        List<SystemToolRegistry> scripted = toolRegistryService.listScriptedEnabled();
        for (SystemToolRegistry row : scripted) {
            toolExecutor.registerDynamicHandler(new RegistryScriptToolHandler(row, sandboxService, objectMapper));
        }
        log.info("Tool 注册中心已同步脚本 Tool: count={}", scripted.size());
    }
}
