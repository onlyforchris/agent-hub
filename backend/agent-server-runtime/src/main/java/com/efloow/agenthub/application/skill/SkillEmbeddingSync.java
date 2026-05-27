package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.service.SkillEmbeddingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class SkillEmbeddingSync {

    private static final Logger log = LoggerFactory.getLogger(SkillEmbeddingSync.class);

    private final SkillEmbeddingService skillEmbeddingService;

    public SkillEmbeddingSync(SkillEmbeddingService skillEmbeddingService) {
        this.skillEmbeddingService = skillEmbeddingService;
    }

    public void indexPublished(SystemSkill skill) {
        try {
            skillEmbeddingService.indexSkill(skill);
        } catch (Exception e) {
            log.warn("Skill embedding 索引失败: code={}, reason={}", skill.getSkillCode(), e.getMessage());
        }
    }

    public int reindexAllPublished() {
        return skillEmbeddingService.reindexPublished();
    }

    public long countIndexed() {
        return skillEmbeddingService.countIndexed();
    }
}
