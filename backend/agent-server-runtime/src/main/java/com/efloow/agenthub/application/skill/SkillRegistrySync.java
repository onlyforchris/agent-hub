package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import com.efloow.agenthub.system.entity.AgentSkillMount;
import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.mapper.AgentSkillMountMapper;
import com.efloow.agenthub.system.mapper.SystemSkillMapper;
import com.efloow.agenthub.system.service.SkillRegistryService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class SkillRegistrySync {

    private static final Logger log = LoggerFactory.getLogger(SkillRegistrySync.class);

    private final SkillRegistryService skillRegistryService;
    private final SystemSkillMapper skillMapper;
    private final AgentSkillMountMapper mountMapper;
    private final ObjectMapper objectMapper;

    private final Map<String, SkillRuntimeView> byCode = new ConcurrentHashMap<>();
    private final Map<String, String> defaultByAgent = new ConcurrentHashMap<>();

    public SkillRegistrySync(
            SkillRegistryService skillRegistryService,
            SystemSkillMapper skillMapper,
            AgentSkillMountMapper mountMapper,
            ObjectMapper objectMapper
    ) {
        this.skillRegistryService = skillRegistryService;
        this.skillMapper = skillMapper;
        this.mountMapper = mountMapper;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        reload();
    }

    public synchronized void reload() {
        byCode.clear();
        defaultByAgent.clear();
        for (SystemSkill row : skillRegistryService.listPublishedRuntimeRows()) {
            SkillRuntimeView view = toRuntimeView(row);
            byCode.put(view.skillCode(), view);
        }
        List<AgentSkillMount> mounts = mountMapper.selectList(
                new LambdaQueryWrapper<AgentSkillMount>()
                        .eq(AgentSkillMount::getIsDefault, 1)
                        .ne(AgentSkillMount::getStatus, 2)
        );
        for (AgentSkillMount mount : mounts) {
            SystemSkill skill = skillMapper.selectById(mount.getSkillId());
            if (skill != null
                && skill.getStatus() != null
                && skill.getStatus() != 2
                && "published".equals(skill.getPublishStatus())
                && skill.getIsEnabled() == 1) {
                defaultByAgent.put(mount.getAgentId(), skill.getSkillCode());
            }
        }
        log.info("Skill Registry 已加载: count={}", byCode.size());
    }

    public SkillRuntimeView getByCode(String skillCode) {
        return byCode.get(skillCode);
    }

    public List<SkillRuntimeView> allPublished() {
        return new ArrayList<>(byCode.values());
    }

    public List<SkillRuntimeView> candidatesForAgent(String agentId) {
        if (agentId == null || agentId.isBlank()) {
            return allPublished();
        }
        List<SystemSkill> rows = skillRegistryService.listPublishedForAgent(agentId);
        return rows.stream().map(this::toRuntimeView).toList();
    }

    public SkillRuntimeView defaultForAgent(String agentId) {
        if (agentId == null) {
            return null;
        }
        String code = defaultByAgent.get(agentId);
        return code == null ? null : byCode.get(code);
    }

    private SkillRuntimeView toRuntimeView(SystemSkill row) {
        return new SkillRuntimeView(
            row.getId(),
            row.getSkillCode(),
            row.getSkillName(),
            row.getDescription(),
            row.getVersion(),
            row.getContentMd(),
            parseStringList(row.getPathsJson()),
            parseMap(row.getPolicyJson()),
            row.getContextMode(),
            row.getAutoInvoke() != null && row.getAutoInvoke() == 1,
            row.getRequireConfirm() == null || row.getRequireConfirm() == 1,
            row.getSideEffectLevel()
        );
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
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
}
