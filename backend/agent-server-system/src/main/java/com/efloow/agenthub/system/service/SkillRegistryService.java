package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.system.dto.SkillDetailDto;
import com.efloow.agenthub.system.dto.SkillResourceDto;
import com.efloow.agenthub.system.dto.SkillSummaryDto;
import com.efloow.agenthub.system.dto.SkillUpsertRequest;
import com.efloow.agenthub.system.entity.AgentSkillMount;
import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.entity.SystemSkillResource;
import com.efloow.agenthub.system.mapper.AgentSkillMountMapper;
import com.efloow.agenthub.system.mapper.SystemSkillMapper;
import com.efloow.agenthub.system.mapper.SystemSkillResourceMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SkillRegistryService {

    private static final Logger log = LoggerFactory.getLogger(SkillRegistryService.class);

    private static final Pattern SKILL_CODE_PATTERN = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");

    public static final String DEFAULT_POLICY_JSON = """
        {
          "network": {"mode": "allow_with_confirm", "allowlist": []},
          "filesystem_write": {"mode": "allow_with_confirm", "paths": ["**"]},
          "scripts": {"mode": "allow_with_confirm", "sandbox": "strict"},
          "tools": {"mode": "inherit", "allowlist": [], "denylist": []},
          "side_effect_level": "medium",
          "auto_invoke": true,
          "context": "inline"
        }
        """;

    private final SystemSkillMapper skillMapper;
    private final SystemSkillResourceMapper skillResourceMapper;
    private final AgentSkillMountMapper mountMapper;
    private final RbacService rbacService;
    private final ObjectMapper objectMapper;

    public SkillRegistryService(
            SystemSkillMapper skillMapper,
            SystemSkillResourceMapper skillResourceMapper,
            AgentSkillMountMapper mountMapper,
            RbacService rbacService,
            ObjectMapper objectMapper
    ) {
        this.skillMapper = skillMapper;
        this.skillResourceMapper = skillResourceMapper;
        this.mountMapper = mountMapper;
        this.rbacService = rbacService;
        this.objectMapper = objectMapper;
    }

    public List<SkillSummaryDto> listAll(String agentId) {
        rbacService.assertPermission("system:skill:view");
        List<SystemSkill> rows;
        if (agentId != null && !agentId.isBlank()) {
            List<String> skillIds = mountMapper.selectList(
                    new LambdaQueryWrapper<AgentSkillMount>()
                            .eq(AgentSkillMount::getAgentId, agentId)
                            .ne(AgentSkillMount::getStatus, 2)
            ).stream().map(AgentSkillMount::getSkillId).toList();
            if (skillIds.isEmpty()) {
                return List.of();
            }
            rows = skillMapper.selectList(
                    new LambdaQueryWrapper<SystemSkill>()
                            .in(SystemSkill::getId, skillIds)
                            .ne(SystemSkill::getStatus, 2)
                            .orderByAsc(SystemSkill::getSortOrder)
                            .orderByAsc(SystemSkill::getSkillCode)
            );
        } else {
            rows = skillMapper.selectList(
                    new LambdaQueryWrapper<SystemSkill>()
                            .ne(SystemSkill::getStatus, 2)
                            .orderByAsc(SystemSkill::getSortOrder)
                            .orderByAsc(SystemSkill::getSkillCode)
            );
        }
        return rows.stream().map(this::toSummary).collect(Collectors.toList());
    }

    public List<SkillSummaryDto> listPublishedCatalog() {
        return skillMapper.selectList(
                new LambdaQueryWrapper<SystemSkill>()
                        .ne(SystemSkill::getStatus, 2)
                        .eq(SystemSkill::getPublishStatus, "published")
                        .eq(SystemSkill::getIsEnabled, 1)
                        .orderByAsc(SystemSkill::getSortOrder)
        ).stream().map(this::toSummary).collect(Collectors.toList());
    }

    public List<SystemSkill> listPublishedRuntimeRows() {
        return skillMapper.selectList(
                new LambdaQueryWrapper<SystemSkill>()
                        .ne(SystemSkill::getStatus, 2)
                        .eq(SystemSkill::getPublishStatus, "published")
                        .eq(SystemSkill::getIsEnabled, 1)
                        .orderByAsc(SystemSkill::getSortOrder)
        );
    }

    public List<SystemSkill> listPublishedForAgent(String agentId) {
        if (agentId == null || agentId.isBlank()) {
            return listPublishedRuntimeRows();
        }
        List<String> skillIds = mountMapper.selectList(
                new LambdaQueryWrapper<AgentSkillMount>()
                        .eq(AgentSkillMount::getAgentId, agentId)
                        .ne(AgentSkillMount::getStatus, 2)
        ).stream().map(AgentSkillMount::getSkillId).toList();
        if (skillIds.isEmpty()) {
            return listPublishedRuntimeRows();
        }
        return skillMapper.selectList(
                new LambdaQueryWrapper<SystemSkill>()
                        .in(SystemSkill::getId, skillIds)
                        .ne(SystemSkill::getStatus, 2)
                        .eq(SystemSkill::getPublishStatus, "published")
                        .eq(SystemSkill::getIsEnabled, 1)
                        .orderByAsc(SystemSkill::getSortOrder)
        );
    }

    public SkillDetailDto getDetail(String id) {
        rbacService.assertPermission("system:skill:view");
        return toDetail(requireSkill(id));
    }

    public SystemSkill requireSkill(String id) {
        SystemSkill row = skillMapper.selectById(id);
        if (row == null || (row.getStatus() != null && row.getStatus() == 2)) {
            throw new BusinessException("S001_SKILL_NOT_FOUND", "Skill 不存在");
        }
        return row;
    }

    public SystemSkill getByCode(String skillCode) {
        return skillMapper.selectOne(
                new LambdaQueryWrapper<SystemSkill>()
                        .eq(SystemSkill::getSkillCode, skillCode)
                        .ne(SystemSkill::getStatus, 2)
                        .last("LIMIT 1")
        );
    }

    public SystemSkill getPublishedByCode(String skillCode) {
        SystemSkill row = getByCode(skillCode);
        if (row == null || !"published".equals(row.getPublishStatus()) || row.getIsEnabled() != 1) {
            return null;
        }
        return row;
    }

    @Transactional
    public String create(SkillUpsertRequest request) {
        rbacService.assertPermission("system:skill:add");
        validateUpsert(request);
        if (getByCode(request.getSkillCode()) != null) {
            throw new BusinessException("C001_DUPLICATE", "Skill Code 已存在: " + request.getSkillCode());
        }
        SystemSkill row = new SystemSkill();
        row.setId(UUID.randomUUID().toString());
        applyUpsert(row, request);
        row.setPublishStatus("draft");
        row.setIsEnabled(0);
        row.setStatus(1);
        row.setVersion("1.0.0");
        row.setCreateBy(currentUserId());
        skillMapper.insert(row);
        log.info("Skill 已创建: code={}, name={}", row.getSkillCode(), row.getSkillName());
        return row.getId();
    }

    @Transactional
    public void update(String id, SkillUpsertRequest request) {
        rbacService.assertPermission("system:skill:edit");
        SystemSkill existing = requireSkill(id);
        validateUpsert(request);
        if (request.getSkillCode() != null && !request.getSkillCode().equals(existing.getSkillCode())) {
            SystemSkill dup = getByCode(request.getSkillCode());
            if (dup != null && !dup.getId().equals(id)) {
                throw new BusinessException("C001_DUPLICATE", "Skill Code 已存在: " + request.getSkillCode());
            }
        }
        applyUpsert(existing, request);
        existing.setUpdateBy(currentUserId());
        skillMapper.updateById(existing);
        log.info("Skill 已更新: id={}, code={}", id, existing.getSkillCode());
    }

    @Transactional
    public void delete(String id) {
        rbacService.assertPermission("system:skill:delete");
        SystemSkill existing = requireSkill(id);
        existing.setStatus(2);
        existing.setUpdateBy(currentUserId());
        skillMapper.updateById(existing);
        log.info("Skill 已删除: id={}, code={}", id, existing.getSkillCode());
    }

    @Transactional
    public SkillDetailDto publishInternal(String id) {
        SystemSkill existing = requireSkill(id);
        if (existing.getDescription() == null || existing.getDescription().isBlank()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "发布前必须填写 description");
        }
        existing.setPublishStatus("published");
        existing.setIsEnabled(1);
        existing.setUpdateBy("system");
        skillMapper.updateById(existing);
        log.info("Skill 已发布(系统): id={}, code={}", id, existing.getSkillCode());
        return toDetail(existing);
    }

    @Transactional
    public SkillDetailDto publish(String id) {
        rbacService.assertPermission("system:skill:publish");
        SystemSkill existing = requireSkill(id);
        if (existing.getDescription() == null || existing.getDescription().isBlank()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "发布前必须填写 description");
        }
        existing.setPublishStatus("published");
        existing.setIsEnabled(1);
        existing.setUpdateBy(currentUserId());
        skillMapper.updateById(existing);
        log.info("Skill 已发布: id={}, code={}", id, existing.getSkillCode());
        return toDetail(existing);
    }

    @Transactional
    public String createFromParsedInternal(
            SkillUpsertRequest request,
            String frontmatterJson,
            String pathsJson,
            String policyJson
    ) {
        validateUpsert(request);
        if (getByCode(request.getSkillCode()) != null) {
            return getByCode(request.getSkillCode()).getId();
        }
        SystemSkill row = new SystemSkill();
        row.setId(UUID.randomUUID().toString());
        applyUpsert(row, request);
        row.setPublishStatus("draft");
        row.setIsEnabled(0);
        row.setStatus(1);
        row.setVersion("1.0.0");
        row.setCreateBy("system");
        row.setFrontmatterJson(frontmatterJson);
        row.setPathsJson(pathsJson);
        row.setPolicyJson(policyJson);
        skillMapper.insert(row);
        return row.getId();
    }

    @Transactional
    public String createFromParsed(
            SkillUpsertRequest request,
            String frontmatterJson,
            String pathsJson,
            String policyJson
    ) {
        String id = create(request);
        SystemSkill row = skillMapper.selectById(id);
        row.setFrontmatterJson(frontmatterJson);
        row.setPathsJson(pathsJson);
        row.setPolicyJson(policyJson);
        row.setUpdateBy(currentUserId());
        skillMapper.updateById(row);
        return id;
    }

    @Transactional
    public void applyParsedMarkdown(SystemSkill row, String frontmatterJson, String contentMd, String pathsJson,
                                    String policyJson) {
        row.setFrontmatterJson(frontmatterJson);
        row.setContentMd(contentMd);
        row.setPathsJson(pathsJson);
        if (policyJson != null && !policyJson.isBlank()) {
            row.setPolicyJson(policyJson);
        }
    }

    private void applyUpsert(SystemSkill row, SkillUpsertRequest request) {
        if (request.getSkillCode() != null) {
            row.setSkillCode(request.getSkillCode().trim());
        }
        if (request.getSkillName() != null) {
            row.setSkillName(request.getSkillName().trim());
        }
        if (request.getDescription() != null) {
            row.setDescription(request.getDescription().trim());
        }
        if (request.getCategory() != null) {
            row.setCategory(request.getCategory());
        }
        if (request.getTags() != null) {
            row.setTags(toJson(request.getTags()));
        }
        if (request.getContentMd() != null) {
            row.setContentMd(request.getContentMd());
        }
        if (request.getPolicyJson() != null) {
            row.setPolicyJson(toJson(request.getPolicyJson()));
            Object level = request.getPolicyJson().get("side_effect_level");
            if (level != null) {
                row.setSideEffectLevel(String.valueOf(level));
            }
            Object context = request.getPolicyJson().get("context");
            if (context != null) {
                row.setContextMode(String.valueOf(context));
            }
            Object auto = request.getPolicyJson().get("auto_invoke");
            if (auto instanceof Boolean b) {
                row.setAutoInvoke(b ? 1 : 0);
            }
        } else if (row.getPolicyJson() == null || row.getPolicyJson().isBlank()) {
            row.setPolicyJson(DEFAULT_POLICY_JSON.trim());
        }
        if (request.getPathsJson() != null) {
            row.setPathsJson(toJson(request.getPathsJson()));
        }
        if (request.getAutoInvoke() != null) {
            row.setAutoInvoke(Boolean.TRUE.equals(request.getAutoInvoke()) ? 1 : 0);
        } else if (row.getAutoInvoke() == null) {
            row.setAutoInvoke(1);
        }
        if (request.getRequireConfirm() != null) {
            row.setRequireConfirm(Boolean.TRUE.equals(request.getRequireConfirm()) ? 1 : 0);
        } else if (row.getRequireConfirm() == null) {
            row.setRequireConfirm(1);
        }
        if (request.getContextMode() != null) {
            row.setContextMode(request.getContextMode());
        } else if (row.getContextMode() == null) {
            row.setContextMode("inline");
        }
        if (request.getOwner() != null) {
            row.setOwner(request.getOwner());
        }
        if (request.getRemark() != null) {
            row.setRemark(request.getRemark());
        }
        if (request.getSortOrder() != null) {
            row.setSortOrder(request.getSortOrder());
        } else if (row.getSortOrder() == null) {
            row.setSortOrder(0);
        }
        if (row.getSideEffectLevel() == null) {
            row.setSideEffectLevel("medium");
        }
    }

    private void validateUpsert(SkillUpsertRequest request) {
        if (request.getSkillCode() == null || request.getSkillCode().isBlank()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "skillCode 不能为空");
        }
        String code = request.getSkillCode().trim();
        if (code.length() > 64 || !SKILL_CODE_PATTERN.matcher(code).matches()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "skillCode 格式无效，需小写字母/数字/连字符");
        }
        if (request.getSkillName() == null || request.getSkillName().isBlank()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "skillName 不能为空");
        }
        if (request.getDescription() != null && request.getDescription().length() > 1024) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "description 不能超过 1024 字符");
        }
        if (request.getContextMode() != null) {
            Set<String> allowed = Set.of("inline", "fork");
            if (!allowed.contains(request.getContextMode())) {
                throw new BusinessException("S006_SKILL_PARSE_INVALID", "contextMode 仅支持 inline/fork");
            }
        }
    }

    private SkillSummaryDto toSummary(SystemSkill row) {
        SkillSummaryDto dto = new SkillSummaryDto();
        dto.setId(row.getId());
        dto.setSkillCode(row.getSkillCode());
        dto.setSkillName(row.getSkillName());
        dto.setDescription(row.getDescription());
        dto.setCategory(row.getCategory());
        dto.setTags(parseStringList(row.getTags()));
        dto.setSideEffectLevel(row.getSideEffectLevel());
        dto.setAutoInvoke(row.getAutoInvoke() != null && row.getAutoInvoke() == 1);
        dto.setIsEnabled(row.getIsEnabled() != null && row.getIsEnabled() == 1);
        dto.setVersion(row.getVersion());
        dto.setPublishStatus(row.getPublishStatus());
        return dto;
    }

    private SkillDetailDto toDetail(SystemSkill row) {
        SkillDetailDto dto = new SkillDetailDto();
        SkillSummaryDto summary = toSummary(row);
        dto.setId(summary.getId());
        dto.setSkillCode(summary.getSkillCode());
        dto.setSkillName(summary.getSkillName());
        dto.setDescription(summary.getDescription());
        dto.setCategory(summary.getCategory());
        dto.setTags(summary.getTags());
        dto.setSideEffectLevel(summary.getSideEffectLevel());
        dto.setAutoInvoke(summary.getAutoInvoke());
        dto.setIsEnabled(summary.getIsEnabled());
        dto.setVersion(summary.getVersion());
        dto.setPublishStatus(summary.getPublishStatus());
        dto.setContentMd(row.getContentMd());
        dto.setFrontmatterJson(parseMap(row.getFrontmatterJson()));
        dto.setPolicyJson(parseMap(row.getPolicyJson()));
        dto.setPathsJson(parseStringList(row.getPathsJson()));
        dto.setContextMode(row.getContextMode());
        dto.setRequireConfirm(row.getRequireConfirm() != null && row.getRequireConfirm() == 1);
        dto.setOwner(row.getOwner());
        dto.setRemark(row.getRemark());
        dto.setResources(loadResourceDtos(row.getId()));
        return dto;
    }

    private List<SkillResourceDto> loadResourceDtos(String skillId) {
        return skillResourceMapper.selectList(
                new LambdaQueryWrapper<SystemSkillResource>()
                        .eq(SystemSkillResource::getSkillId, skillId)
                        .ne(SystemSkillResource::getStatus, 2)
                        .orderByAsc(SystemSkillResource::getResourcePath)
        ).stream().map(this::toResourceDto).collect(Collectors.toList());
    }

    private SkillResourceDto toResourceDto(SystemSkillResource row) {
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

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private java.util.Map<String, Object> parseMap(String json) {
        if (json == null || json.isBlank()) {
            return java.util.Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<java.util.Map<String, Object>>() {});
        } catch (Exception e) {
            return java.util.Map.of();
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "JSON 序列化失败");
        }
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return "system";
        }
        return auth.getName();
    }
}
