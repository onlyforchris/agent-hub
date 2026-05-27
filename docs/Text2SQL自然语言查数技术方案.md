# Text2SQL 自然语言查数技术方案

## 1. 概述

本文档为「规则与接入 → 系统连接器」的后续链路设计：用户在已配置的 MySQL 数据源上，通过**自然语言提问 → 自动生成只读 SQL → 执行 → 结果可视化**，完成"问数→出表→出图"的完整闭环。

### 1.1 核心约束（不可变）

延续「规则与接入与系统连接器设计」中的安全原则：

- **LLM 只负责 SQL 生成，不直接触库。**
- SQL 执行前必经**静态安全校验**（白名单表/列、敏感操作拦截、结果集上限）。
- 所有 SQL 通过 JDBC **参数化执行**，禁止拼接。
- 全程审计：traceId + 输入问题 + 生成 SQL + 执行耗时 + 结果行数。

### 1.2 行业基线

| 做法 | 准确率 | 说明 |
|------|:------:|------|
| 直接把全部 DDL 丢给 LLM | ~17% | GPT-4 在 Spider 基准上的原始成绩 |
| + 语义层（业务术语映射 + 指标定义） | ~54% | AtScale 在 TPC-DS 上 |
| + 约束 JOIN 路径 + 预定义指标 | ~92% | 加语义层后的完整方案 |
| 多 Agent 分解 + 纠错循环 | ~92% | SQL-of-Thought 在 Spider dev 上 |

结论：**原始 Schema 喂给 LLM 基本没用。** 工业界标准做法是 RAG + 语义层 + 多步推理。

---

## 2. 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                         前端交互层                                │
│  自然语言输入 → Data Panel（表格 + ECharts 图表）                 │
└──────────────────────────────┬───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                     Text2SQL Pipeline（Agent）                    │
│                                                                   │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌───────────────┐  │
│  │ 意图解析 │──▶│Schema检索 │──▶│ SQL 生成  │──▶│ 静态校验 +    │  │
│  │ + 语义层 │   │(向量+RAG) │   │ (LLM)    │   │ JDBC 执行     │  │
│  └─────────┘   └──────────┘   └──────────┘   └───────────────┘  │
│                                                    │             │
│                                           ┌────────▼─────────┐   │
│                                           │ 结果校验 + 纠错    │   │
│                                           └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                         数据基础设施层                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Schema 知识库     │  │ 语义术语字典      │  │ 历史问答库     │  │
│  │ (表/列/关系/示例) │  │ (业务词→表.字段)  │  │ (Q&A 向量索引) │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**四层结构：**
- **Layer 0 — 元数据层**：从已连接数据源提取完整 Schema（列详情、主外键、示例值），存储并定期刷新
- **Layer 1 — 语义映射层**：业务术语 → 表/列的映射字典 + 预定义指标公式，这是准确率从 17% 跃升到 54% 的关键
- **Layer 2 — 检索 + 生成层**：向量检索命中相关 Schema 片段，组装 Prompt，LLM 生成 SQL
- **Layer 3 — 执行 + 可视化层**：静态校验 → JDBC 只读执行 → 结果集脱敏 → 前端图表

---

## 3. 数据库设计

### 3.1 表：`data_source_schema_cache` — Schema 缓存快照

```
从连接器 metadata 接口扩展，拉取完整 Schema 后存储在此表。
```

| 列 | 类型 | 说明 |
|----|------|------|
| id | text | 主键，`conn_{connectionId}` |
| connection_id | text | 关联 text2sql_data_connection.id |
| db_type | text | MYSQL |
| schema_snapshot | jsonb | 完整 Schema JSON（表/列/索引/外键） |
| sample_values | jsonb | 每表每列的示例值（最多 3 个） |
| refreshed_at | timestamp(6) | 上次刷新时间 |
| refresh_status | int4 | 0=待刷新, 1=成功, 2=失败 |
| refresh_error | text | 上次刷新失败原因 |
| status / remark / create_by / create_time / update_by / update_time | — | 公共字段 |

Schema 快照 JSON 结构：

```json
{
  "tables": [
    {
      "tableName": "payment_record",
      "tableComment": "支付流水表",
      "rowEstimate": 1250000,
      "columns": [
        {
          "name": "receipt_amount",
          "type": "decimal(18,2)",
          "nullable": false,
          "comment": "到账金额",
          "isPrimaryKey": false,
          "sampleValues": ["150000.00", "8250.50", "1200000.00"]
        }
      ]
    }
  ],
  "foreignKeys": [
    {
      "name": "fk_payment_account",
      "fromTable": "payment_record",
      "fromColumn": "account_id",
      "toTable": "treasury_account",
      "toColumn": "id"
    }
  ]
}
```

### 3.2 表：`text2sql_semantic_term` — 业务术语字典

| 列 | 类型 | 说明 |
|----|------|------|
| id | text | 主键 |
| term | text | 业务术语，如"到账金额"、"司库账户" |
| term_type | text | TERM / METRIC / FILTER |
| connection_id | text | 关联数据源，NULL 表示全局 |
| table_name | text | 映射的目标表 |
| column_name | text | 映射的目标列，指标可为 NULL |
| formula | text | 指标计算公式，如 `SUM(receipt_amount)` |
| filter_condition | text | 附加过滤条件 |
| priority | int4 | 优先级，数值越大越优先匹配 |
| status / remark / create_by / create_time / update_by / update_time | — | 公共字段 |

### 3.3 表：`text2sql_query_history` — 历史问答记录

| 列 | 类型 | 说明 |
|----|------|------|
| id | text | 主键 |
| connection_id | text | 关联数据源 |
| user_question | text | 用户原始问题 |
| generated_sql | text | LLM 生成的 SQL |
| executed_sql | text | 最终执行的参数化 SQL |
| execution_status | text | SUCCESS / FAILED / REJECTED |
| row_count | int4 | 返回行数 |
| duration_ms | int4 | 执行耗时 |
| error_message | text | 失败原因 |
| user_feedback | int4 | 用户反馈：1=有用, 0=无反馈, -1=不准确 |
| trace_id | text | 关联的 Trace ID |
| status / remark / create_by / create_time / update_by / update_time | — | 公共字段 |

> `text2sql_query_history` 为**不可变表**（仅 INSERT），status: 0=失败/异常, 1=成功/正常。

### 3.4 已有表复用

| 表 | 用途 |
|----|------|
| `text2sql_data_connection` | 已实现，数据源连接配置 |
| `sys_model_provider` | 已实现，用于 SQL 生成的 LLM |

---

## 4. Layer 0 — 元数据增强（Phase 1）

### 4.1 当前状态

现有 `GET /api/text2sql/connectors/{id}/metadata` 只返回 `information_schema.TABLES` 的表名 + 表类型（BASE TABLE / VIEW）。

### 4.2 需要增强

扩展 `MySqlJdbcHelper.loadSchemaSnapshot()` 方法，一次 JDBC 连接内完成：

```
1. information_schema.TABLES      → 表名 + 表注释 + 估算行数
2. information_schema.COLUMNS     → 每列：名、类型、是否可空、是否主键、列注释
3. information_schema.KEY_COLUMN_USAGE → 外键关系
4. 每表取 2~3 个示例值（SELECT DISTINCT col LIMIT 3，仅对 TEXT/VARCHAR 列）
```

查询语句：

```sql
-- 表信息
SELECT TABLE_NAME, TABLE_COMMENT, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ? AND TABLE_TYPE IN ('BASE TABLE','VIEW')
ORDER BY TABLE_NAME

-- 列详情
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE,
       IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT, ORDINAL_POSITION
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = ?
ORDER BY TABLE_NAME, ORDINAL_POSITION

-- 外键
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME,
       REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
```

### 4.3 新增 API

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/text2sql/connectors/{id}/schema/refresh` | 触发 Schema 刷新 |
| GET | `/api/text2sql/connectors/{id}/schema` | 获取已缓存 Schema |

### 4.4 安全约束

- 示例值采集**跳过**列名含 `password` / `secret` / `token` / `key` 的列
- 示例值总大小限制 5MB，超限截断
- Schema JSON 中的 `sampleValues` 不包含任何凭据信息
- 日志仅记录 table/column 名称，不记录示例值内容

---

## 5. Layer 1 — 语义映射层（Phase 2）

### 5.1 为什么必须

通用 LLM 不认识你们的业务领域。`司库账户` 对应哪张表哪个字段？`到账金额` 是 `receipt_amount` 还是 `arrival_amount`？`本周` 的 SQL 边界怎么界定？这些都需要人工配置一次。

### 5.2 术语类型

| 类型 | 示例 | 作用 |
|------|------|------|
| TERM | "到账金额" → `payment_record.receipt_amount` | 实体/字段映射 |
| METRIC | "经营现金流" = `SUM(cash_in) - SUM(cash_out) WHERE category='OPERATING'` | 指标公式 |
| FILTER | "本周" = `date >= date_trunc('week', current_date)` | 时间/条件模板 |

### 5.3 匹配策略

```
用户问题 → 分词 + embedding
           │
           ├── 精确匹配：term = 用户词（优先级最高）
           ├── 模糊匹配：embedding 相似度 > 0.85
           └── 未匹配：作为原始列名参与 Schema 检索
```

匹配到的术语直接注入 Prompt 的 `Semantic Context` 段。

### 5.4 术语管理

- 每个连接器可拥有独立的术语集（connection_id 绑定），未绑定的为全局共享
- 通过管理后台 CRUD（复用 Settings 页面或系统连接器页面 Tab）
- 支持批量导入（Excel）

---

## 6. Layer 2 — SQL 生成流水线（Phase 2-3）

### 6.1 整体流程

```
用户问题: "上周各账户的到账金额汇总"
    │
    ▼
Step 1 - 意图解析 (LLM, 轻量)
    输出: {intent: "AGGREGATE", entities: ["账户","到账金额"],
           timeRange: "上周", aggregation: "SUM", groupBy: "账户"}
    │
    ▼
Step 2 - Schema 检索 (向量 + 语义层)
    用 entities + 语义层映射的 table.column 
    → 向量检索召回相关 3~8 张表
    → 提取对应的 DDL + 示例值 + FK
    │
    ▼
Step 3 - Prompt 组装
    System Prompt + 检索到的 Schema + 匹配的语义术语
    + 历史相似问答(3条) + 用户问题
    │
    ▼
Step 4 - LLM 生成 SQL (LlmGateway)
    要求输出格式:
    <think>分析思路</think>
    <sql>SELECT ...</sql>
    │
    ▼
Step 5 - 静态安全校验 (非 LLM)
    ├── 语法解析 (JSqlParser)
    ├── 语句类型必须是 SELECT
    ├── 表名/列名白名单检查
    ├── 自动补 LIMIT 1000（如未指定）
    └── 不通过 → 拒绝 + 返回原因
    │
    ▼
Step 6 - JDBC 执行
    PreparedStatement 参数化
    超时 10s, 结果集上限 10000 行
    │
    ▼
Step 7 - 结果校验
    ├── 空结果 → 提示可能原因
    ├── 行数 = LIMIT 上限 → 提示可能数据被截断
    └── SQL 异常 → 错误消息 + Schema 重新喂 LLM 修正（最多 2 轮）
```

### 6.2 Prompt 模板结构

```
System:
你是数据分析 SQL 专家。只生成 SELECT 语句。
禁止：INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC, CALL。
结果集必须使用 LIMIT 限制。

Context — 相关表结构:
{table_ddl_with_comments}
{foreign_key_relations}
{sample_values}

Context — 业务术语:
{semantic_mappings}

Context — 历史相似问题:
{few_shot_examples}

Question: {user_question}

Output: <think>分析过程</think> <sql>SQL语句</sql>
```

### 6.3 静态校验器（核心安全组件）

```java
// 伪代码结构
public class SqlSafetyValidator {
    // 1. 解析 SQL AST
    // 2. 检查：必须是 SELECT，不能有子查询中的 DML
    // 3. 提取所有 table.column 引用
    // 4. 与本次检索出的 schema 白名单对比
    // 5. 检查 LIMIT（无则追加 LIMIT 1000）
    // 6. 返回校验结果：PASS / REJECT + reason
}
```

### 6.4 纠错循环

```
执行失败 / 返回异常结果
    │
    ▼
组装 ErrorContext: {
    originalQuestion, generatedSql, errorMessage,
    relevantSchema (精简到出错表)
}
    │
    ▼
LLM 分析错误原因 → 修正 SQL → 重新校验 → 重新执行
    │
    ▼
最多 2 轮，仍失败则返回原始错误给用户
```

---

## 7. Layer 3 — 结果与可视化（Phase 3）

### 7.1 结果格式

```json
{
  "question": "上周各账户的到账金额汇总",
  "sql": "SELECT a.account_name, SUM(p.receipt_amount) ...",
  "columns": ["account_name", "total_amount"],
  "rows": [["账户A", 1250000.00], ["账户B", 830000.50]],
  "rowCount": 15,
  "executionMs": 230,
  "chartSuggestion": "bar"
}
```

### 7.2 前端 Data Panel

- **表格视图**：Ant Design Table，列头显示中文注释（从 Schema Comment 取）
- **图表视图**：ECharts 自动推断图表类型
  - 1 维度 + 1 数值 → 柱状图
  - 1 时间维度 + 1 数值 → 折线图
  - 1 类别 + 1 数值 → 饼图（Top 10 + 其他）
- **追问**：在结果下方可继续自然语言提问（上下文继承）
- **导出**：Excel / CSV

---

## 8. API 与权限码

### 8.1 新增资源

| resource_code | Method | Path | 说明 |
|----------------|--------|------|------|
| connector:datasource:schema:refresh | POST | `/api/text2sql/connectors/{id}/schema/refresh` | 刷新 Schema 缓存 |
| connector:datasource:schema:view | GET | `/api/text2sql/connectors/{id}/schema` | 查看 Schema |
| text2sql:query:execute | POST | `/api/text2sql/query` | 执行自然语言查询 |
| text2sql:query:history | GET | `/api/text2sql/query/history` | 查询历史 |
| text2sql:term:add | POST | `/api/text2sql/terms` | 新增术语 |
| text2sql:term:edit | PUT | `/api/text2sql/terms/{id}` | 编辑术语 |
| text2sql:term:delete | DELETE | `/api/text2sql/terms/{id}` | 删除术语 |
| text2sql:term:list | GET | `/api/text2sql/terms` | 术语列表 |

### 8.2 端点路径分类

| 分类 | 配置位置 | 说明 |
|------|----------|------|
| Schema 刷新/查看 | `sys_resource` | 需 resource_code 校验 |
| 术语 CRUD | `sys_resource` | 管理类操作 |
| 自然语言查询 | `sys_resource` | 核心接口，需审计 |
| 查询历史 | `sys_resource` | 只读 |

---

## 9. 实施计划

### Phase 1：元数据增强（当前阶段）

| 任务 | 产出 |
|------|------|
| 扩展 `MySqlJdbcHelper` 的 Schema 采集 | 表 + 列 + 外键 + 示例值 |
| 新建 `data_source_schema_cache` 表 | DDL + COMMENT ON |
| 新增 refresh / view API | Controller + Service |
| 前端 Schema 浏览面板 | 系统连接器页面内 Tab 或抽屉 |
| 注册 RBAC 资源 + 授权 | 002/003 SQL |

### Phase 2：语义层 + RAG（下一阶段）

| 任务 | 产出 |
|------|------|
| 新建 `text2sql_semantic_term` 表 + CRUD | 术语管理 |
| Schema 向量化存储（pgvector 或内存） | 检索能力 |
| Prompt 模板 + LlmGateway 对接 | SQL 生成 |
| 静态校验器 | 安全组件 |
| JDBC 只读执行 | 查询执行 |

### Phase 3：纠错 + 可视化（后续）

| 任务 | 产出 |
|------|------|
| 纠错循环 | 执行失败自动修正 |
| Data Panel 前端 | 表格 + ECharts 图表 |
| 查询历史 + 反馈收集 | 持续优化 |

---

## 10. 安全底线

1. **LLM 不直接触库**：SQL 生成后经校验器 + JDBC 参数化执行，LLM 无数据库连接
2. **白名单机制**：SQL 中引用的表/列必须在 Schema 检索出的白名单内，防止跨表/跨库访问
3. **只读强制**：静态校验拦截所有非 SELECT 语句
4. **结果集上限**：强制 `LIMIT 1000`（可配置），防止全表扫描撑爆内存
5. **超时保护**：JDBC 查询超时 10s
6. **审计追踪**：每次查询记录 traceId + 原始问题 + 生成 SQL + 执行 SQL + 耗时 + 行数
7. **凭据安全**：外部 MySQL 密码仅存加密字段，不在日志/API 响应中输出
8. **示例值过滤**：跳过 `password/secret/token/key` 列，避免敏感数据进入 Schema 快照

---

## 11. 与现有系统的关系

| 现有组件 | 本方案中的角色 |
|----------|---------------|
| `Text2SqlConnectionController` | 数据源连接管理（已完成），扩展 Schema 刷新 |
| `Text2SqlConnectionService` | 扩展 Schema 缓存管理 |
| `MySqlJdbcHelper` | 扩展完整 Schema 采集 + 示例值采集 |
| `LlmGateway` (agent-server-runtime) | SQL 生成 LLM 调用 |
| `AgentBase` | Text2SQL 整体编排 Agent（可选，二期可独立为 Text2SqlAgent） |
| `ResourceAuthorizationFilter` | API 权限校验（沿用） |
| `TraceService` | 全链路 Trace（沿用） |
| 前端 `SystemConnectorPage` | 新增 Schema 浏览 Tab |

---

## 12. 文档与代码对照表

| 主题 | 主要位置 |
|------|-----------|
| 数据源连接管理 | `agent-server-system/.../text2sql/` |
| Schema 缓存表 | `database/init/001_schema.sql` |
| 语义术语表 | `database/init/001_schema.sql` |
| 查询历史表 | `database/init/001_schema.sql` |
| Schema 采集逻辑 | `agent-server-system/.../text2sql/MySqlJdbcHelper.java` |
| SQL 校验器 | `agent-server-runtime/.../text2sql/SqlSafetyValidator.java`（Phase 2） |
| 自然语言查询入口 | `agent-server-system/.../text2sql/Text2SqlQueryController.java`（Phase 2） |
| 前端 Data Panel | `agent-web/src/pages/`（Phase 3） |

本文档持续演进，具体字段与接口以仓库内代码为准。
