package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.system.dto.SkillResourceDto;
import com.efloow.agenthub.system.dto.SkillResourceUpsertRequest;
import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.entity.SystemSkillResource;
import com.efloow.agenthub.system.mapper.SystemSkillResourceMapper;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SkillResourceService {

    private static final Logger log = LoggerFactory.getLogger(SkillResourceService.class);

    private static final Set<String> RESOURCE_KINDS = Set.of("reference", "script", "asset");
    private static final int MAX_INLINE_BYTES = 512 * 1024;

    private final SystemSkillResourceMapper resourceMapper;
    private final SkillRegistryService skillRegistryService;
    private final RbacService rbacService;

    public SkillResourceService(
            SystemSkillResourceMapper resourceMapper,
            SkillRegistryService skillRegistryService,
            RbacService rbacService
    ) {
        this.resourceMapper = resourceMapper;
        this.skillRegistryService = skillRegistryService;
        this.rbacService = rbacService;
    }

    public List<SkillResourceDto> listBySkillId(String skillId) {
        rbacService.assertPermission("system:skill:view");
        skillRegistryService.requireSkill(skillId);
        return resourceMapper.selectList(
                new LambdaQueryWrapper<SystemSkillResource>()
                        .eq(SystemSkillResource::getSkillId, skillId)
                        .ne(SystemSkillResource::getStatus, 2)
                        .orderByAsc(SystemSkillResource::getResourcePath)
        ).stream().map(this::toDto).collect(Collectors.toList());
    }

    public List<SystemSkillResource> listRuntimeBySkillId(String skillId) {
        return resourceMapper.selectList(
                new LambdaQueryWrapper<SystemSkillResource>()
                        .eq(SystemSkillResource::getSkillId, skillId)
                        .ne(SystemSkillResource::getStatus, 2)
                        .orderByAsc(SystemSkillResource::getResourcePath)
        );
    }

    @Transactional
    public String create(String skillId, SkillResourceUpsertRequest request) {
        rbacService.assertPermission("system:skill:edit");
        skillRegistryService.requireSkill(skillId);
        validateUpsert(request);
        assertPathUnique(skillId, request.getResourcePath(), null);
        SystemSkillResource row = new SystemSkillResource();
        row.setId(UUID.randomUUID().toString());
        row.setSkillId(skillId);
        applyUpsert(row, request);
        row.setStatus(1);
        row.setCreateBy(currentUserId());
        resourceMapper.insert(row);
        log.info("Skill 资源已创建: skillId={}, path={}", skillId, row.getResourcePath());
        return row.getId();
    }

    @Transactional
    public void update(String skillId, String resourceId, SkillResourceUpsertRequest request) {
        rbacService.assertPermission("system:skill:edit");
        skillRegistryService.requireSkill(skillId);
        SystemSkillResource existing = requireResource(skillId, resourceId);
        validateUpsert(request);
        if (request.getResourcePath() != null
                && !request.getResourcePath().equals(existing.getResourcePath())) {
            assertPathUnique(skillId, request.getResourcePath(), resourceId);
        }
        applyUpsert(existing, request);
        existing.setUpdateBy(currentUserId());
        resourceMapper.updateById(existing);
        log.info("Skill 资源已更新: skillId={}, path={}", skillId, existing.getResourcePath());
    }

    @Transactional
    public void delete(String skillId, String resourceId) {
        rbacService.assertPermission("system:skill:edit");
        skillRegistryService.requireSkill(skillId);
        SystemSkillResource existing = requireResource(skillId, resourceId);
        existing.setStatus(2);
        existing.setUpdateBy(currentUserId());
        resourceMapper.updateById(existing);
        log.info("Skill 资源已删除: skillId={}, path={}", skillId, existing.getResourcePath());
    }

    @Transactional
    public void replaceAllForSkill(SystemSkill skill, List<ImportedResource> imported) {
        resourceMapper.update(
                null,
                new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<SystemSkillResource>()
                        .eq(SystemSkillResource::getSkillId, skill.getId())
                        .ne(SystemSkillResource::getStatus, 2)
                        .set(SystemSkillResource::getStatus, 2)
                        .set(SystemSkillResource::getUpdateBy, currentUserId())
        );
        for (ImportedResource item : imported) {
            SystemSkillResource row = new SystemSkillResource();
            row.setId(UUID.randomUUID().toString());
            row.setSkillId(skill.getId());
            row.setResourcePath(normalizePath(item.path()));
            row.setResourceKind(inferKind(item.path()));
            if (item.content() != null && item.content().length <= MAX_INLINE_BYTES) {
                row.setContentText(new String(item.content(), java.nio.charset.StandardCharsets.UTF_8));
            } else if (item.content() != null) {
                throw new BusinessException("S006_SKILL_PARSE_INVALID",
                        "资源过大需走对象存储: " + item.path() + " (>512KB)");
            }
            row.setStatus(1);
            row.setCreateBy(currentUserId());
            resourceMapper.insert(row);
        }
        log.info("Skill 资源已批量导入: skillId={}, count={}", skill.getId(), imported.size());
    }

    public SystemSkillResource requireResource(String skillId, String resourceId) {
        SystemSkillResource row = resourceMapper.selectById(resourceId);
        if (row == null
                || !skillId.equals(row.getSkillId())
                || (row.getStatus() != null && row.getStatus() == 2)) {
            throw new BusinessException("S008_SKILL_RESOURCE_MISSING", "Skill 资源不存在");
        }
        return row;
    }

    private void validateUpsert(SkillResourceUpsertRequest request) {
        if (request.getResourcePath() == null || request.getResourcePath().isBlank()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "resourcePath 不能为空");
        }
        String path = normalizePath(request.getResourcePath());
        if (path.contains("..") || path.startsWith("/")) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "resourcePath 非法: " + path);
        }
        if (request.getResourceKind() != null
                && !RESOURCE_KINDS.contains(request.getResourceKind().trim().toLowerCase())) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "resourceKind 仅支持 reference/script/asset");
        }
        if (request.getContentText() != null
                && request.getContentText().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_INLINE_BYTES) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "contentText 超过 512KB 上限");
        }
    }

    private void applyUpsert(SystemSkillResource row, SkillResourceUpsertRequest request) {
        if (request.getResourcePath() != null) {
            row.setResourcePath(normalizePath(request.getResourcePath()));
        }
        if (request.getResourceKind() != null) {
            row.setResourceKind(request.getResourceKind().trim().toLowerCase());
        } else if (row.getResourceKind() == null) {
            row.setResourceKind(inferKind(row.getResourcePath()));
        }
        if (request.getContentText() != null) {
            row.setContentText(request.getContentText());
        }
        if (request.getStorageUri() != null) {
            row.setStorageUri(request.getStorageUri());
        }
        if (request.getRemark() != null) {
            row.setRemark(request.getRemark());
        }
    }

    private void assertPathUnique(String skillId, String path, String excludeId) {
        SystemSkillResource dup = resourceMapper.selectOne(
                new LambdaQueryWrapper<SystemSkillResource>()
                        .eq(SystemSkillResource::getSkillId, skillId)
                        .eq(SystemSkillResource::getResourcePath, normalizePath(path))
                        .ne(SystemSkillResource::getStatus, 2)
                        .last("LIMIT 1")
        );
        if (dup != null && (excludeId == null || !excludeId.equals(dup.getId()))) {
            throw new BusinessException("C001_DUPLICATE", "资源路径已存在: " + path);
        }
    }

    public static String normalizePath(String path) {
        return path.replace('\\', '/').replaceAll("^/+", "");
    }

    static String inferKind(String path) {
        String normalized = normalizePath(path);
        if (normalized.startsWith("scripts/") || normalized.endsWith(".py") || normalized.endsWith(".sh")) {
            return "script";
        }
        if (normalized.startsWith("assets/")) {
            return "asset";
        }
        return "reference";
    }

    private SkillResourceDto toDto(SystemSkillResource row) {
        SkillResourceDto dto = new SkillResourceDto();
        dto.setId(row.getId());
        dto.setSkillId(row.getSkillId());
        dto.setResourcePath(row.getResourcePath());
        dto.setResourceKind(row.getResourceKind());
        dto.setContentText(row.getContentText());
        dto.setStorageUri(row.getStorageUri());
        dto.setRemark(row.getRemark());
        return dto;
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return "system";
        }
        return auth.getName();
    }

    public record ImportedResource(String path, byte[] content) {}
}
