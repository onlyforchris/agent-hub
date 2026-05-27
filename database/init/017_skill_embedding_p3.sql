-- ============================================================================
-- 017 Skill P3: pgvector 维度对齐 + 向量索引
-- 依赖: 013_skill_registry.sql
-- 说明: KeywordEmbeddingProvider 默认 1024 维，与 text2sql 索引一致
-- ============================================================================

ALTER TABLE sys_skill_embedding
    ALTER COLUMN embedding_vector TYPE vector(1024)
    USING CASE
        WHEN embedding_vector IS NULL THEN NULL
        ELSE embedding_vector::vector(1024)
    END;

CREATE INDEX IF NOT EXISTS idx_sys_skill_embedding_skill
    ON sys_skill_embedding (skill_id)
    WHERE status = 1;
