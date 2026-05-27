package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.common.tool.ToolCategories;
import com.efloow.agenthub.system.entity.SystemToolRegistry;
import com.efloow.agenthub.system.mapper.SystemToolRegistryMapper;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ToolRegistryService {

    private static final Logger log = LoggerFactory.getLogger(ToolRegistryService.class);

    private static final Set<String> SCRIPT_RUNTIMES = Set.of("GROOVY", "CLI", "PYTHON_FILE");

    private final SystemToolRegistryMapper mapper;
    private final RbacService rbacService;

    public ToolRegistryService(SystemToolRegistryMapper mapper, RbacService rbacService) {
        this.mapper = mapper;
        this.rbacService = rbacService;
    }

    public List<SystemToolRegistry> listAll() {
        rbacService.assertPermission("system:tool:view");
        return mapper.selectList(
                new LambdaQueryWrapper<SystemToolRegistry>()
                        .ne(SystemToolRegistry::getStatus, 2)
                        .orderByAsc(SystemToolRegistry::getSortOrder)
                        .orderByAsc(SystemToolRegistry::getToolKey)
        );
    }

    public List<SystemToolRegistry> listScriptedEnabled() {
        return mapper.selectList(
                new LambdaQueryWrapper<SystemToolRegistry>()
                        .ne(SystemToolRegistry::getStatus, 2)
                        .eq(SystemToolRegistry::getIsEnabled, 1)
                        .in(SystemToolRegistry::getRuntimeKind, SCRIPT_RUNTIMES)
                        .isNotNull(SystemToolRegistry::getScriptContent)
        );
    }

    public SystemToolRegistry getById(String id) {
        rbacService.assertPermission("system:tool:view");
        SystemToolRegistry row = mapper.selectById(id);
        if (row == null || (row.getStatus() != null && row.getStatus() == 2)) {
            throw new BusinessException("D001_NOT_FOUND", "Tool 不存在");
        }
        return row;
    }

    public SystemToolRegistry getByToolKey(String toolKey) {
        return mapper.selectOne(
                new LambdaQueryWrapper<SystemToolRegistry>()
                        .eq(SystemToolRegistry::getToolKey, toolKey)
                        .ne(SystemToolRegistry::getStatus, 2)
                        .last("LIMIT 1")
        );
    }

    @Transactional
    public String create(SystemToolRegistry tool) {
        rbacService.assertPermission("system:tool:add");
        requireAny(tool.getToolKey(), tool.getToolName());
        validateRuntime(tool);
        if (getByToolKey(tool.getToolKey()) != null) {
            throw new BusinessException("C001_DUPLICATE", "Tool Key 已存在: " + tool.getToolKey());
        }
        String id = UUID.randomUUID().toString();
        tool.setId(id);
        tool.setCreateBy(currentUserId());
        tool.setStatus(tool.getStatus() != null ? tool.getStatus() : 1);
        tool.setIsEnabled(tool.getIsEnabled() != null ? tool.getIsEnabled() : 1);
        tool.setSortOrder(tool.getSortOrder() != null ? tool.getSortOrder() : 0);
        mapper.insert(tool);
        log.info("Tool 已注册: key={}, name={}", tool.getToolKey(), tool.getToolName());
        return id;
    }

    @Transactional
    public void update(String id, SystemToolRegistry tool) {
        rbacService.assertPermission("system:tool:edit");
        SystemToolRegistry existing = getById(id);
        validateRuntime(tool);
        if (tool.getToolKey() != null && !tool.getToolKey().equals(existing.getToolKey())) {
            SystemToolRegistry dup = getByToolKey(tool.getToolKey());
            if (dup != null && !dup.getId().equals(id)) {
                throw new BusinessException("C001_DUPLICATE", "Tool Key 已存在: " + tool.getToolKey());
            }
            existing.setToolKey(tool.getToolKey());
        }
        if (tool.getToolName() != null) {
            existing.setToolName(tool.getToolName());
        }
        if (tool.getCategory() != null) {
            existing.setCategory(tool.getCategory());
        }
        if (tool.getDescription() != null) {
            existing.setDescription(tool.getDescription());
        }
        if (tool.getRuntimeKind() != null) {
            existing.setRuntimeKind(tool.getRuntimeKind());
        }
        if (tool.getScriptContent() != null) {
            existing.setScriptContent(tool.getScriptContent());
        }
        if (tool.getInputSchema() != null) {
            existing.setInputSchema(tool.getInputSchema());
        }
        if (tool.getOutputSchema() != null) {
            existing.setOutputSchema(tool.getOutputSchema());
        }
        if (tool.getConnector() != null) {
            existing.setConnector(tool.getConnector());
        }
        if (tool.getDataSensitivity() != null) {
            existing.setDataSensitivity(tool.getDataSensitivity());
        }
        if (tool.getSideEffect() != null) {
            existing.setSideEffect(tool.getSideEffect());
        }
        if (tool.getPermissionCode() != null) {
            existing.setPermissionCode(tool.getPermissionCode());
        }
        if (tool.getVersion() != null) {
            existing.setVersion(tool.getVersion());
        }
        if (tool.getOwner() != null) {
            existing.setOwner(tool.getOwner());
        }
        if (tool.getIsEnabled() != null) {
            existing.setIsEnabled(tool.getIsEnabled());
        }
        if (tool.getSortOrder() != null) {
            existing.setSortOrder(tool.getSortOrder());
        }
        if (tool.getRemark() != null) {
            existing.setRemark(tool.getRemark());
        }
        existing.setUpdateBy(currentUserId());
        mapper.updateById(existing);
        log.info("Tool 已更新: id={}, key={}", id, existing.getToolKey());
    }

    @Transactional
    public void delete(String id) {
        rbacService.assertPermission("system:tool:delete");
        SystemToolRegistry existing = getById(id);
        existing.setStatus(2);
        existing.setUpdateBy(currentUserId());
        mapper.updateById(existing);
        log.info("Tool 已删除: id={}, key={}", id, existing.getToolKey());
    }

    private void validateRuntime(SystemToolRegistry tool) {
        if (tool.getCategory() == null || !ToolCategories.isValid(tool.getCategory())) {
            throw new BusinessException(
                    "C002_INVALID_SCHEMA",
                    "category 必须为: data_query / rule / compute / template / notify"
            );
        }
        tool.setCategory(tool.getCategory().trim());

        String kind = tool.getRuntimeKind() != null ? tool.getRuntimeKind().trim().toUpperCase() : "GROOVY";
        if ("JAVASCRIPT".equals(kind) || "SPEL".equals(kind)) {
            throw new BusinessException("C002_INVALID_SCHEMA", "仅支持 Groovy 脚本运行时，请使用 GROOVY");
        }
        if (!"JAVA_BEAN".equals(kind) && !"GROOVY".equals(kind) && !"CLI".equals(kind) && !"PYTHON_FILE".equals(kind)) {
            throw new BusinessException("C002_INVALID_SCHEMA", "runtime_kind 仅支持 GROOVY / JAVA_BEAN / CLI / PYTHON_FILE");
        }
        tool.setRuntimeKind(kind);
        if (SCRIPT_RUNTIMES.contains(kind) && !"CLI".equals(kind) && !"PYTHON_FILE".equals(kind)) {
            if (tool.getScriptContent() == null || tool.getScriptContent().isBlank()) {
                throw new BusinessException("C002_INVALID_SCHEMA", "脚本型 Tool 必须填写 script_content");
            }
        }
    }

    private void requireAny(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return;
            }
        }
        throw new BusinessException("C002_INVALID_SCHEMA", "缺少必填字段");
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return "system";
        }
        return auth.getName();
    }
}
