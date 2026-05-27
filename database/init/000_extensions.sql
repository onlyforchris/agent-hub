-- ============================================================================
-- 000_extensions.sql — 创建所需 PostgreSQL 扩展（须最先执行）
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS vector;
