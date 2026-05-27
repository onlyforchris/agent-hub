package com.efloow.agenthub.infrastructure.skill;

import com.efloow.agenthub.application.skill.SkillEmbeddingSync;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 启动时若尚无 Skill 向量索引，则为已发布 Skill 批量构建 embedding。
 */
@Component
public class SkillEmbeddingBootstrap {

    private static final Logger log = LoggerFactory.getLogger(SkillEmbeddingBootstrap.class);

    private final SkillEmbeddingSync skillEmbeddingSync;

    public SkillEmbeddingBootstrap(SkillEmbeddingSync skillEmbeddingSync) {
        this.skillEmbeddingSync = skillEmbeddingSync;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void bootstrapEmbeddings() {
        try {
            if (skillEmbeddingSync.countIndexed() > 0) {
                return;
            }
            int count = skillEmbeddingSync.reindexAllPublished();
            log.info("Skill embedding 首次构建完成: reindexed={}", count);
        } catch (Exception e) {
            log.warn("Skill embedding 启动重建跳过: {}", e.getMessage());
        }
    }
}
