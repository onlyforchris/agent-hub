# Text2SQL — RAG 与语义检索技术方案（Phase 2）

## 1. 概述

Phase 1 完成了元数据采集：从远端 MySQL 拉取表/列/外键/示例值，缓存到本地 `data_source_schema_cache`（JSONB）。Phase 2 的目标是将这些结构化数据**向量化、建立分层索引、实现语义检索**，为 SQL 生成的 Prompt 组装提供高质量上下文。

### 1.1 为什么 Phase 1 不够

Phase 1 的 Schema 快照是一次性拉取的**全量数据**。一个典型 TMS 库可能有 50-200 张表、500-3000 个列。直接把全部 DDL 塞进 LLM Prompt：

- Token 超限（200 表 × 平均 20 列 = 4000 行 DDL，远超上下文窗口）
- 准确率暴跌（无关信息淹没相关信号，行业数据约 17%）
- 成本浪费（每次查询消耗大量 input token）

**RAG 解决的就是"从 200 张表里找出与当前问题相关的 3-5 张表"。**

### 1.2 行业基线回顾

| 方案 | 执行准确率 (EX) | 核心手段 |
|------|:------:|----------|
| 全量 DDL 直喂 LLM | ~17% | 无检索 |
| 粗粒度向量检索（单表级） | ~50% | 表级 embedding |
| 分层向量检索（表+列） + 外键图扩展 | ~70% | SchemaGraphSQL 思路 |
| 分层检索 + 历史问答 + 语义层 + Self-Consistency | ~86% | DAIL-SQL 风格 |
| 多 Agent 分解 + 纠错循环 | ~92% | SQL-of-Thought |
| 分层检索 + 语义层 + 投票（Phase 2 目标） | **75-85%** | 务实方案 |

---

## 2. 向量基础设施

### 2.1 pgvector 扩展

在现有 PostgreSQL 16 实例上启用 `pgvector` 扩展，**零新基础设施**。

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Docker 环境变更**：使用定制镜像 `efloow-postgres:16`（基于 `pgvector/pgvector:pg16` + apt 加装 TimescaleDB），构建文件见 `docker/Dockerfile.postgres`。数据目录兼容标准 PG16，无需迁移。

### 2.2 Embedding 模型选型

| 方案 | 维度 | 中文效果 | 部署方式 | 推荐度 |
|------|:----:|:--------:|----------|:------:|
| BGE-large-zh-v1.5 | 1024 | **最优** | 本地 ONNX / Python 服务 | ★★★★ |
| BGE-small-zh-v1.5 | 512 | 良好 | 本地 ONNX（轻量） | ★★★ |
| OpenAI text-embedding-3-small | 1536 | 良好 | API 调用 | ★★ |
| DeepSeek V4 复用 | 不定 | 中等 | 已有 LlmGateway | ★ |

**推荐 BGE-large-zh-v1.5（1024 维）**：
- 中文语义匹配 SOTA 级别，司库/现金流/财务领域术语识别能力强
- 部署方式：在 `agent-server-runtime` 中通过 ONNX Runtime 加载量化模型（~300MB），纯 Java 无需 Python 服务
- 备选：若不想引入本地模型，可用 OpenAI text-embedding-3-small API（已有模型供应商机制可扩展）

### 2.3 向量表设计

两张独立向量表，对应**表级**和**列级**两个检索粒度：

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- 表级向量索引
CREATE TABLE IF NOT EXISTS text2sql_table_embedding (
    id              text NOT NULL,
    connection_id   text NOT NULL,
    table_name      text NOT NULL,
    chunk_text      text NOT NULL,          -- 向量化原文：表名 + COMMENT
    embedding       vector(1024),           -- 1024 维对应 BGE-large-zh-v1.5
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT text2sql_table_embedding_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_table_emb_hnsw
    ON text2sql_table_embedding USING HNSW (embedding vector_cosine_ops);

COMMENT ON TABLE text2sql_table_embedding IS 'Text2SQL 表级向量索引';
COMMENT ON COLUMN text2sql_table_embedding.chunk_text IS '向量化原文: {table_name} {table_comment}';
COMMENT ON COLUMN text2sql_table_embedding.embedding IS '1024 维向量, BGE-large-zh-v1.5';

-- 列级向量索引
CREATE TABLE IF NOT EXISTS text2sql_column_embedding (
    id              text NOT NULL,
    connection_id   text NOT NULL,
    table_name      text NOT NULL,
    column_name     text NOT NULL,
    chunk_text      text NOT NULL,          -- 向量化原文：表名.列名 + 类型 + COMMENT + 示例值
    embedding       vector(1024),
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT text2sql_column_embedding_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_column_emb_hnsw
    ON text2sql_column_embedding USING HNSW (embedding vector_cosine_ops);

COMMENT ON TABLE text2sql_column_embedding IS 'Text2SQL 列级向量索引';
COMMENT ON COLUMN text2sql_column_embedding.chunk_text IS '向量化原文: {table}.{column} {type} {comment} {samples}';
```

### 2.4 为什么不选 pgvector 以外的方案

| 方案 | 问题 |
|------|------|
| ChromaDB / Milvus | 需要独立部署，增加运维复杂度 |
| FAISS 内存 | 无持久化，重启丢失 |
| Redis Stack | 已有 Redis 7（非 Stack 版），升级有风险 |
| **pgvector** | **与 PG 同实例，零运维增量，事务一致性** |

---

## 3. 向量化流水线

### 3.1 索引构建流程

```
Schema 缓存(data_source_schema_cache)
    │
    ▼
逐表遍历 → 拼接 chunk_text
    ├── 表级: "{table_name} {table_comment}"
    └── 列级: "{table_name}.{column_name} {data_type} {column_comment} 示例值: {sampleValues}"
    │
    ▼
Embedding 服务 (BGE / OpenAI)
    │
    ▼
批量 UPSERT 到 text2sql_table_embedding / text2sql_column_embedding
```

### 3.2 Chunk 文本拼接规则

**表级 chunk：**
```
{table_name} | {table_comment} | 行数约{row_estimate}
```
示例：`payment_record | 支付流水表 | 行数约1250000`

**列级 chunk（关键——质量决定检索命中率）：**
```
{table_name}.{column_name} | 类型:{column_type} | {column_comment} | 示例:{sample_values}
```
示例：`payment_record.receipt_amount | 类型:decimal(18,2) | 到账金额 | 示例:150000.00, 8250.50`

### 3.3 触发时机

- **手动**：Schema 刷新后，前端「重建索引」按钮
- **自动**：Schema 刷新成功时，级联触发索引重建
- **增量**：后续支持（表结构变更时局部更新）

### 3.4 新增 API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/text2sql/connectors/{id}/index/build` | 为该数据源构建向量索引 |
| GET | `/api/text2sql/connectors/{id}/index/status` | 索引状态（向量数、最后构建时间） |

---

## 4. 语义检索流水线

### 4.1 检索流程

```
用户问题: "上周各司库账户的到账金额汇总"
    │
    ▼
Step 1 — Embedding: 问题 → BGE → 问题向量(1024维)
    │
    ▼
Step 2 — 表级检索:
    SELECT table_name, chunk_text,
           1 - (embedding <=> ?) AS similarity
    FROM text2sql_table_embedding
    WHERE connection_id = ?
    ORDER BY embedding <=> ?
    LIMIT 10
    │ → 返回 Top-10 候选表 + 相似度分数
    │
    ▼
Step 3 — 列级检索:
    SELECT table_name, column_name, chunk_text,
           1 - (embedding <=> ?) AS similarity
    FROM text2sql_column_embedding
    WHERE connection_id = ? AND table_name IN (候选表列表)
    ORDER BY embedding <=> ?
    LIMIT 30
    │ → 在候选表范围内精确匹配列
    │
    ▼
Step 4 — 外键图扩展:
    从候选表的 FK 关系中, 纳入直接关联的邻接表
    （如 payment_record.account_id → treasury_account）
    │
    ▼
Step 5 — 组装检索结果:
    {
      candidateTables: [表1(score 0.92), 表2(score 0.87), ...]  ← Top 5-8
      candidateColumns: [列1(score 0.95), 列2(score 0.91), ...],
      expandedTables: [FK扩展的表],
      foreignKeys: [相关FK关系]
    }
```

### 4.2 检索参数

| 参数 | 默认值 | 说明 |
|------|:------:|------|
| 表级 Top-K | 10 | 召回候选表数 |
| 列级 Top-K | 30 | 在候选表内召回列数 |
| 相似度阈值 | 0.5 | 低于此值的表/列丢弃 |
| FK 扩展深度 | 1 | 最多扩展一跳邻接表 |
| 最终送入 Prompt 的表数 | 5-8 | 去重 + 排序后取 Top |

### 4.3 语义术语增强检索

Phase 2 同步建设 `text2sql_semantic_term` 表（方案文档 Phase 2 第 5 节已定义）。在向量检索之前，先做**精确术语匹配**：

```
用户问题
    │
    ├── 精确匹配: 问题中包含已注册的业务术语
    │   → 直接将映射的 table.column 标记为 MUST_INCLUDE
    │
    └── 语义匹配: embedding 相似度 > 0.85
        → 将映射的 table.column 提升检索权重
```

精确匹配到的表/列**直接进入候选集**，不依赖向量检索命中。

---

## 5. Prompt 组装策略

### 5.1 Prompt 模板（DAIL-SQL 风格）

```
System:
你是 {db_type} SQL 专家。只生成只读 SELECT 语句。
禁止: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC, CALL。
结果集必须包含 LIMIT。

=== 相关表结构 ===
{检索到的表DDL + 列注释 + 示例值}

=== 外键关系 ===
{相关FK}

=== 业务术语 ===
{匹配的术语 → table.column 映射}

=== 历史相似问题 ===
{3条最相似的历史 Q&A}

=== 当前问题 ===
{user_question}

Output format:
<think>分析思路</think>
<sql>SQL语句</sql>
```

### 5.2 Prompt 尺寸控制

| 内容段 | Token 预算 | 说明 |
|--------|:----------:|------|
| System Prompt | ~100 | 安全规则固定 |
| 表 DDL | ~800 | 5-8 张表，每表约 100 tokens |
| 外键关系 | ~100 | 仅相关 FK |
| 业务术语 | ~100 | 命中的术语 |
| 历史问答 | ~400 | 3 条 few-shot |
| 用户问题 | ~50 | — |
| **合计** | **~1,550** | 远低于上下文窗口 |

### 5.3 Few-Shot 示例检索

从 `text2sql_query_history` 中检索与当前问题最相似的历史成功问答。检索方式：将历史问题的 SQL + 结果摘要做 embedding，与当前问题向量做余弦相似度匹配。

```
历史记录:
  Q: "本月各账户入账金额"  SQL: SELECT account, SUM(amount)...  ✓ 成功
  Q: "上周现金流汇总"      SQL: SELECT SUM(cash_in)...         ✓ 成功
  Q: "查询所有交易"        SQL: SELECT * FROM transactions      ✗ 被拒绝(无LIMIT)
  → 只选 status=SUCCESS 且有用户正向反馈的记录
```

---

## 6. 语义术语管理（Phase 2 同步）

### 6.1 表：`text2sql_semantic_term`

已在 Phase 1 方案文档中定义，此处补充实现细节。

| 列 | 类型 | 说明 |
|----|------|------|
| id | text | 主键 |
| connection_id | text | 关联数据源，NULL = 全局共享 |
| term | text | 业务术语 |
| term_type | text | TERM（实体映射）/ METRIC（指标公式）/ FILTER（条件模板） |
| table_name | text | 映射目标表 |
| column_name | text | 映射目标列 |
| formula | text | METRIC 类型的 SQL 表达式 |
| filter_condition | text | 附加 WHERE 条件片段 |
| priority | int4 | 优先级，精确匹配优先 |
| embedding | vector(1024) | 术语的向量（用于模糊匹配，可延迟构建） |

### 6.2 术语匹配策略

```
用户问题分词 → 逐词检查术语表
    ├── term = 用户词原文 → 精确命中，直接注入 Prompt
    ├── embedding 相似度 > 0.85 → 模糊命中，降低权重注入
    └── 未命中 → 跳过
```

---

## 7. 历史问答采集与反馈闭环

### 7.1 `text2sql_query_history` 表

已在 Phase 1 方案文档中定义（不可变表）。核心字段：

- `user_question` → 原始问题
- `generated_sql` → LLM 生成的 SQL
- `executed_sql` → 实际执行的参数化 SQL
- `execution_status` → SUCCESS / FAILED / REJECTED
- `user_feedback` → 1=有用, -1=不准确（前端 👍👎）

### 7.2 反馈如何改进系统

| 反馈类型 | 自动化动作 |
|----------|-----------|
| 👍 有用 | SQL → embedding → 存入 few-shot 候选池，提高同类问题命中率 |
| 👎 不准确 | 记录失败原因 → 人工审核 → 修正后补充为术语或训练样本 |
| 被拒绝（REJECTED） | 分析拒绝原因 → 调整安全校验白名单或术语映射 |

---

## 8. Embedding 服务实现方案

### 8.1 推荐：抽象 EmbeddingProvider 接口

复用已有的模型供应商机制（`sys_model_provider`），扩展支持 Embedding 模型：

```java
public interface EmbeddingProvider {
    /** 将文本列表转为向量列表 */
    List<float[]> embed(List<String> texts);

    /** 返回向量维度 */
    int dimension();
}
```

### 8.2 实现：BGE ONNX（推荐）

在 `agent-server-runtime` 中通过 ONNX Runtime 加载 BGE 量化模型：

- 依赖：`com.microsoft.onnxruntime:onnxruntime`（纯 Java）
- 模型文件：`bge-large-zh-v1.5-int8.onnx`（~300MB，放在 resources/models/）
- Tokenizer：用 HuggingFace tokenizer JSON 或手动实现 BERT tokenizer（BGE 的 tokenizer 规则固定）
- 优势：无网络依赖、无 API 费用、延迟 < 10ms/条

### 8.3 备选：API 模式

若不想在 Java 侧跑模型，可通过 `LlmGateway` 扩展调用外部 Embedding API：

```yaml
# 在 sys_model_provider 中新增一条记录
provider_code: openai-emb
base_url: https://api.openai.com/v1
api_key: sk-xxx
models: ["text-embedding-3-small"]
```

### 8.4 选择建议

| 条件 | 推荐方案 |
|------|---------|
| 可接受 300MB 额外模型文件 + 本地推理 | BGE ONNX |
| 希望最小化 Java 侧复杂度 | API 模式（需要外部 embedding 供应商） |
| 数据安全要求高、不允外传 Schema 信息 | BGE ONNX（必须） |

> 注意：Schema 文本（表名、列名、注释）会作为 embedding 输入发送给 API。如果这些信息属于敏感业务数据，必须用本地模型。

---

## 9. 实施任务拆解

### Task 2.1：pgvector 环境部署
- Docker Compose 切换 `pgvector/pgvector:pg16`
- 执行 `CREATE EXTENSION vector`
- 建两张向量表 + HNSW 索引

### Task 2.2：Embedding 服务
- 定义 `EmbeddingProvider` 接口
- 实现 BGE ONNX（或 API）版本
- 提供单条/批量 embed 方法

### Task 2.3：索引构建
- `Text2SqlIndexService`：从 `data_source_schema_cache` 读取 Schema，遍历表/列生成 chunk，调 embed 生成向量，UPSERT 到向量表
- `POST /connectors/{id}/index/build` + `GET /connectors/{id}/index/status`

### Task 2.4：语义检索
- `Text2SqlRetrievalService`：问题 embedding → 表级检索 → 列级检索 → FK 图扩展 → 组装 RetrievalContext
- 单测验证检索命中率

### Task 2.5：术语表 + CRUD
- 建 `text2sql_semantic_term` 表
- Entity + Mapper + Service + Controller
- 前端术语管理页（系统连接器页面 Tab 或管理后台子页）

### Task 2.6：Prompt 组装
- `Text2SqlPromptBuilder`：接收 RetrievalContext + 用户问题 → 组装完整 Prompt
- 注入历史 few-shot 示例

### Task 2.7：前端索引管理
- 系统连接器页面新增「索引状态」列（已建/未建/向量数）
- 「构建索引」按钮 + 进度提示

---

## 10. 里程碑

| 节点 | 可验证产出 |
|------|-----------|
| pgvector 部署 | `SELECT * FROM pg_extension WHERE extname='vector'` 有结果 |
| 索引构建完成 | `SELECT count(*) FROM text2sql_table_embedding` > 0 |
| 语义检索可用 | 输入「到账金额」→ 检索返回 `payment_record.receipt_amount` 列 |
| Prompt 组装 | 完整 Prompt 日志可见 DDL + FK + few-shot + 术语 |
| 端到端 | 输入自然语言 → SQL → JDBC 执行 → 有结果返回 |

---

## 11. 文档与代码对照表

| 主题 | 主要位置 |
|------|-----------|
| 向量表 | `database/init/001_schema.sql` |
| Embedding 接口 | `agent-server-runtime/.../embedding/EmbeddingProvider.java` |
| BGE 实现 | `agent-server-runtime/.../embedding/BgeEmbeddingProvider.java` |
| 索引构建服务 | `agent-server-system/.../text2sql/Text2SqlIndexService.java` |
| 语义检索服务 | `agent-server-system/.../text2sql/Text2SqlRetrievalService.java` |
| Prompt 组装 | `agent-server-system/.../text2sql/Text2SqlPromptBuilder.java` |
| 术语管理后端 | `agent-server-system/.../text2sql/Text2SqlSemanticTermController.java` |
| 术语管理前端 | `agent-web/src/pages/` |
| pgvector 部署 | `database/init/005_pgvector.sql` |
| 迁移 SQL | `database/init/006_text2sql_rag.sql` |

本文档持续演进，具体字段与接口以仓库内代码为准。
