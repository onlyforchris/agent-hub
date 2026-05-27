package com.efloow.agenthub.controller;

import com.efloow.agenthub.application.tool.ToolExecutor;
import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.infrastructure.tool.sandbox.ToolRegistrySync;
import com.efloow.agenthub.system.dto.ToolTestRequest;
import com.efloow.agenthub.system.dto.ToolTestResultDto;
import com.efloow.agenthub.system.entity.SystemToolRegistry;
import com.efloow.agenthub.system.service.RbacService;
import com.efloow.agenthub.system.service.ToolRegistryService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rbac/tools")
public class ToolRegistryController {

    private final ToolRegistryService toolRegistryService;
    private final ToolExecutor toolExecutor;
    private final ToolRegistrySync toolRegistrySync;
    private final RbacService rbacService;

    public ToolRegistryController(
            ToolRegistryService toolRegistryService,
            ToolExecutor toolExecutor,
            ToolRegistrySync toolRegistrySync,
            RbacService rbacService
    ) {
        this.toolRegistryService = toolRegistryService;
        this.toolExecutor = toolExecutor;
        this.toolRegistrySync = toolRegistrySync;
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<List<SystemToolRegistry>> list() {
        return R.ok(toolRegistryService.listAll());
    }

    @PostMapping
    public R<String> add(@RequestBody SystemToolRegistry tool) {
        String id = toolRegistryService.create(tool);
        toolRegistrySync.reload();
        return R.ok(id);
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody SystemToolRegistry tool) {
        toolRegistryService.update(id, tool);
        toolRegistrySync.reload();
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        toolRegistryService.delete(id);
        toolRegistrySync.reload();
        return R.ok(null);
    }

    @PostMapping("/reload")
    public R<Map<String, Object>> reload() {
        rbacService.assertPermission("system:tool:reload");
        toolRegistrySync.reload();
        return R.ok(Map.of("reloaded", true, "catalogSize", toolExecutor.catalog().size()));
    }

    @PostMapping("/{id}/test")
    public R<ToolTestResultDto> test(@PathVariable String id, @RequestBody(required = false) ToolTestRequest request) {
        rbacService.assertPermission("system:tool:test");
        SystemToolRegistry tool = toolRegistryService.getById(id);
        Map<String, Object> params = request != null && request.getParams() != null ? request.getParams() : Map.of();
        long start = System.currentTimeMillis();
        ToolResult result = toolExecutor.invoke(tool.getToolKey(), params, tool.getPermissionCode());
        ToolTestResultDto dto = new ToolTestResultDto();
        dto.setSuccess(result.success());
        dto.setData(result.data());
        dto.setErrorCode(result.errorCode());
        dto.setErrorMessage(result.errorMessage());
        dto.setDurationMs(System.currentTimeMillis() - start);
        return R.ok(dto);
    }
}
