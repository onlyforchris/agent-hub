package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.application.embedding.EmbeddingProvider;
import com.efloow.agenthub.system.config.SkillRoutingProperties;
import com.efloow.agenthub.system.entity.AgentSkillMount;
import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.entity.SystemSkillEmbedding;
import com.efloow.agenthub.system.mapper.AgentSkillMountMapper;
import com.efloow.agenthub.system.mapper.SystemSkillEmbeddingMapper;
import com.efloow.agenthub.system.mapper.SystemSkillMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SkillEmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(SkillEmbeddingService.class);

    public record EmbeddingHit(String skillId, String skillCode, double score, String reason) {}

    private final SystemSkillEmbeddingMapper embeddingMapper;
    private final SystemSkillMapper skillMapper;
    private final AgentSkillMountMapper mountMapper;
    private final EmbeddingProvider embeddingProvider;
    private final SkillRoutingProperties routingProperties;
    private final ObjectMapper objectMapper;

    public SkillEmbeddingService(
            SystemSkillEmbeddingMapper embeddingMapper,
            SystemSkillMapper skillMapper,
            AgentSkillMountMapper mountMapper,
            EmbeddingProvider embeddingProvider,
            SkillRoutingProperties routingProperties,
            ObjectMapper objectMapper
    ) {
        this.embeddingMapper = embeddingMapper;
        this.skillMapper = skillMapper;
        this.mountMapper = mountMapper;
        this.embeddingProvider = embeddingProvider;
        this.routingProperties = routingProperties;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void indexSkill(SystemSkill skill) {
        if (skill == null || skill.getId() == null) {
            return;
        }
        if (!"published".equals(skill.getPublishStatus()) || skill.getIsEnabled() != 1) {
            embeddingMapper.deleteBySkillId(skill.getId());
            return;
        }
        String routingText = buildRoutingText(skill);
        if (routingText.isBlank()) {
            return;
        }
        float[] vector = embeddingProvider.embed(routingText);
        if (vector.length != embeddingProvider.dimension()) {
            log.warn("Skill embedding 维度不匹配: skillCode={}, expected={}", skill.getSkillCode(),
                    embeddingProvider.dimension());
        }

        embeddingMapper.deleteBySkillId(skill.getId());
        SystemSkillEmbedding row = new SystemSkillEmbedding();
        row.setId(UUID.randomUUID().toString());
        row.setSkillId(skill.getId());
        row.setEmbeddingModel(routingProperties.getEmbeddingModelLabel());
        row.setEmbeddingVector(toPgVector(vector));
        row.setRoutingText(routingText);
        row.setStatus(1);
        row.setCreateBy("system");
        row.setCreateTime(LocalDateTime.now());
        row.setUpdateBy("system");
        row.setUpdateTime(LocalDateTime.now());
        embeddingMapper.insert(row);
        log.info("Skill embedding 已索引: code={}, dim={}", skill.getSkillCode(), vector.length);
    }

    public List<EmbeddingHit> search(String query, String agentId, int topK) {
        if (!routingProperties.isEmbeddingEnabled() || query == null || query.isBlank()) {
            return List.of();
        }
        List<String> skillIds = resolveSkillIds(agentId);
        if (skillIds.isEmpty()) {
            return List.of();
        }
        float[] qVec = embeddingProvider.embed(query);
        List<SystemSkillEmbedding> rows = embeddingMapper.searchSimilar(
                toPgVector(qVec),
                skillIds,
                Math.max(topK, 1)
        );
        Map<String, SystemSkill> skillById = new LinkedHashMap<>();
        for (SystemSkillEmbedding row : rows) {
            skillById.computeIfAbsent(row.getSkillId(), id -> skillMapper.selectById(id));
        }

        List<EmbeddingHit> hits = new ArrayList<>();
        for (SystemSkillEmbedding row : rows) {
            SystemSkill skill = skillById.get(row.getSkillId());
            if (skill == null || skill.getStatus() == 2 || skill.getAutoInvoke() != 1) {
                continue;
            }
            double score = row.getSimilarity() != null ? row.getSimilarity() : 0;
            hits.add(new EmbeddingHit(
                    skill.getId(),
                    skill.getSkillCode(),
                    score,
                    "pgvector 相似度 " + String.format("%.3f", score)
            ));
        }
        return hits;
    }

    @Transactional
    public int reindexPublished() {
        List<SystemSkill> rows = skillMapper.selectList(
                new LambdaQueryWrapper<SystemSkill>()
                        .ne(SystemSkill::getStatus, 2)
                        .eq(SystemSkill::getPublishStatus, "published")
                        .eq(SystemSkill::getIsEnabled, 1)
        );
        for (SystemSkill row : rows) {
            indexSkill(row);
        }
        log.info("Skill embedding 批量重建完成: count={}", rows.size());
        return rows.size();
    }

    public long countIndexed() {
        return embeddingMapper.selectCount(
                new LambdaQueryWrapper<SystemSkillEmbedding>().eq(SystemSkillEmbedding::getStatus, 1)
        );
    }

    private List<String> resolveSkillIds(String agentId) {
        if (agentId == null || agentId.isBlank()) {
            return skillMapper.selectList(
                    new LambdaQueryWrapper<SystemSkill>()
                            .ne(SystemSkill::getStatus, 2)
                            .eq(SystemSkill::getPublishStatus, "published")
                            .eq(SystemSkill::getIsEnabled, 1)
            ).stream().map(SystemSkill::getId).toList();
        }
        List<String> mounted = mountMapper.selectList(
                new LambdaQueryWrapper<AgentSkillMount>()
                        .eq(AgentSkillMount::getAgentId, agentId)
                        .ne(AgentSkillMount::getStatus, 2)
        ).stream().map(AgentSkillMount::getSkillId).toList();
        if (mounted.isEmpty()) {
            return skillMapper.selectList(
                    new LambdaQueryWrapper<SystemSkill>()
                            .ne(SystemSkill::getStatus, 2)
                            .eq(SystemSkill::getPublishStatus, "published")
                            .eq(SystemSkill::getIsEnabled, 1)
            ).stream().map(SystemSkill::getId).toList();
        }
        return mounted;
    }

    String buildRoutingText(SystemSkill skill) {
        StringBuilder sb = new StringBuilder();
        if (skill.getSkillCode() != null) {
            sb.append(skill.getSkillCode()).append(' ');
        }
        if (skill.getSkillName() != null) {
            sb.append(skill.getSkillName()).append(' ');
        }
        if (skill.getDescription() != null) {
            sb.append(skill.getDescription()).append(' ');
        }
        if (skill.getCategory() != null) {
            sb.append(skill.getCategory()).append(' ');
        }
        for (String tag : parseTags(skill.getTags())) {
            sb.append(tag).append(' ');
        }
        return sb.toString().trim();
    }

    private List<String> parseTags(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    static String toPgVector(float[] vec) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vec.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(vec[i]);
        }
        sb.append(']');
        return sb.toString();
    }
}
