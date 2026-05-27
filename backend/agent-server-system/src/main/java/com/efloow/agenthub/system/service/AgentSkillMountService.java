package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.system.dto.AgentSkillMountDto;
import com.efloow.agenthub.system.dto.AgentSkillMountSyncRequest;
import com.efloow.agenthub.system.entity.AgentSkillMount;
import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.mapper.AgentSkillMountMapper;
import com.efloow.agenthub.system.mapper.SystemSkillMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgentSkillMountService {

    private static final Logger log = LoggerFactory.getLogger(AgentSkillMountService.class);

    private final AgentSkillMountMapper mountMapper;
    private final SystemSkillMapper skillMapper;
    private final RbacService rbacService;
    private final ObjectMapper objectMapper;

    public AgentSkillMountService(
            AgentSkillMountMapper mountMapper,
            SystemSkillMapper skillMapper,
            RbacService rbacService,
            ObjectMapper objectMapper
    ) {
        this.mountMapper = mountMapper;
        this.skillMapper = skillMapper;
        this.rbacService = rbacService;
        this.objectMapper = objectMapper;
    }

    public List<AgentSkillMountDto> listByAgent(String agentId) {
        rbacService.assertPermission("system:agent:skill:view");
        List<AgentSkillMount> mounts = mountMapper.selectList(
                new LambdaQueryWrapper<AgentSkillMount>()
                        .eq(AgentSkillMount::getAgentId, agentId)
                        .ne(AgentSkillMount::getStatus, 2)
                        .orderByAsc(AgentSkillMount::getSortOrder)
        );
        List<AgentSkillMountDto> result = new ArrayList<>();
        for (AgentSkillMount mount : mounts) {
            SystemSkill skill = skillMapper.selectById(mount.getSkillId());
            if (skill == null || (skill.getStatus() != null && skill.getStatus() == 2)) {
                continue;
            }
            result.add(toDto(mount, skill));
        }
        return result;
    }

    @Transactional
    public List<AgentSkillMountDto> syncMounts(String agentId, AgentSkillMountSyncRequest request) {
        rbacService.assertPermission("system:agent:skill:edit");
        if (request.getMounts() == null) {
            throw new BusinessException("C001_INVALID", "mounts 不能为空");
        }

        List<AgentSkillMount> existing = mountMapper.selectList(
                new LambdaQueryWrapper<AgentSkillMount>()
                        .eq(AgentSkillMount::getAgentId, agentId)
                        .ne(AgentSkillMount::getStatus, 2)
        );
        Map<String, AgentSkillMount> existingBySkillId = new HashMap<>();
        for (AgentSkillMount row : existing) {
            existingBySkillId.put(row.getSkillId(), row);
        }

        int sort = 10;
        boolean defaultAssigned = false;
        String userId = currentUserId();

        for (AgentSkillMountSyncRequest.MountItem item : request.getMounts()) {
            SystemSkill skill = resolveSkill(item);
            if (skill == null) {
                throw new BusinessException("S001_SKILL_NOT_FOUND", "Skill 不存在: "
                        + (item.getSkillCode() != null ? item.getSkillCode() : item.getSkillId()));
            }

            boolean isDefault = Boolean.TRUE.equals(item.getIsDefault());
            if (isDefault) {
                if (defaultAssigned) {
                    isDefault = false;
                } else {
                    defaultAssigned = true;
                }
            }

            AgentSkillMount row = existingBySkillId.remove(skill.getId());
            if (row == null) {
                row = new AgentSkillMount();
                row.setId(UUID.randomUUID().toString());
                row.setAgentId(agentId);
                row.setSkillId(skill.getId());
                row.setStatus(1);
                row.setCreateBy(userId);
                row.setIsDefault(isDefault ? 1 : 0);
                row.setSortOrder(item.getSortOrder() != null ? item.getSortOrder() : sort);
                row.setPolicyOverride(item.getPolicyOverride() != null ? toJson(item.getPolicyOverride()) : null);
                mountMapper.insert(row);
            } else {
                row.setIsDefault(isDefault ? 1 : 0);
                row.setSortOrder(item.getSortOrder() != null ? item.getSortOrder() : sort);
                row.setPolicyOverride(item.getPolicyOverride() != null ? toJson(item.getPolicyOverride()) : null);
                row.setUpdateBy(userId);
                mountMapper.updateById(row);
            }
            sort += 10;
        }

        for (AgentSkillMount orphan : existingBySkillId.values()) {
            orphan.setStatus(2);
            orphan.setUpdateBy(userId);
            mountMapper.updateById(orphan);
        }

        log.info("Agent Skill 挂载已同步: agentId={}, count={}", agentId, request.getMounts().size());
        return listByAgent(agentId);
    }

    private SystemSkill resolveSkill(AgentSkillMountSyncRequest.MountItem item) {
        if (item.getSkillId() != null && !item.getSkillId().isBlank()) {
            SystemSkill row = skillMapper.selectById(item.getSkillId());
            if (row != null && row.getStatus() != null && row.getStatus() != 2) {
                return row;
            }
        }
        if (item.getSkillCode() != null && !item.getSkillCode().isBlank()) {
            return skillMapper.selectOne(
                    new LambdaQueryWrapper<SystemSkill>()
                            .eq(SystemSkill::getSkillCode, item.getSkillCode())
                            .ne(SystemSkill::getStatus, 2)
                            .last("LIMIT 1")
            );
        }
        return null;
    }

    private AgentSkillMountDto toDto(AgentSkillMount mount, SystemSkill skill) {
        AgentSkillMountDto dto = new AgentSkillMountDto();
        dto.setId(mount.getId());
        dto.setAgentId(mount.getAgentId());
        dto.setSkillId(skill.getId());
        dto.setSkillCode(skill.getSkillCode());
        dto.setSkillName(skill.getSkillName());
        dto.setDescription(skill.getDescription());
        dto.setSideEffectLevel(skill.getSideEffectLevel());
        dto.setIsDefault(mount.getIsDefault() != null && mount.getIsDefault() == 1);
        dto.setSortOrder(mount.getSortOrder());
        dto.setPolicyOverride(parseMap(mount.getPolicyOverride()));
        return dto;
    }

    private Map<String, Object> parseMap(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
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
