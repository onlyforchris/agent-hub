# Text2SQL — SQL 生成与端到端执行方案（Phase 3）

## 1. 进度回顾

### Phase 1（元数据增强）— 已完成 ✅

- 数据源连接管理（CRUD / 测试 / 库表清单）
- Schema 全量采集（表 + 列 + 外键 + 示例值）
- `data_source_schema_cache` 缓存表
- Schema 刷新 / 查看 API
- 前端 Schema 浏览面板（系统连接器内 Drawer）

### Phase 2（语义层 + RAG）— 后台完成 ✅，前端完成 ✅

| 模块 | 文件 | 状态 |
|------|------|:--:|
| pgvector + TimescaleDB | `docker/Dockerfile.postgres`, `005_pgvector.sql` | ✅ |
| 向量表 + HNSW 索引 | `text2sql_table_embedding`, `text2sql_column_embedding` | ✅ |
| EmbeddingProvider | `application/embedding/EmbeddingProvider.java` | ✅ |
| Mock/Api 实现 | `infrastructure/embedding/{Mock,Api}EmbeddingProvider.java` | ✅ |
| 索引构建 | `Text2SqlIndexService.java` + `POST .../{id}/index/build` | ✅ |
| 语义检索 | `Text2SqlRetrievalService.java` + `POST .../{id}/retrieve` | ✅ |
| 语义术语 CRUD | `Text2SqlTerm{Service,Controller}.java` + `/api/text2sql/terms` | ✅ |
| Prompt 组装 | `Text2SqlPromptBuilder.java` | ✅ |
| 前端索引管理 | SystemConnectorPage "构建索引" 按钮 | ✅ |
| 前端术语管理 | `SemanticTermDrawer.tsx` | ✅ |

### Phase 2 遗留：Embedding 模型

当前 `text2sql.embedding.provider=mock` 返回随机向量，**索引和检索均不可用**。需要切换为真实 Embedding。

---

## 2. Phase 3 总体目标

**输入自然语言 → 输出查询结果**，打通完整链路：

```
用户问题 → 语义检索 → Prompt 组装 → LLM 生成 SQL
    → 静态校验 → JDBC 执行 → 结果返回 → 前端 Data Panel
```

---

## 3. 实施任务

### Task 3.1：真实 Embedding 接入（关键前置）

**当前状态：** `MockEmbeddingProvider` 返回随机向量，索引和语义检索形同虚设。

**方案选择：**

| 方案 | 维度 | 延迟 | 费用 | 推荐度 |
|------|:----:|:----:|:----:|:------:|
| BGE-small-zh-v1.5（ONNX 本地） | 512 | ~5ms | 免费 | ★★★ |
| BGE-large-zh-v1.5（ONNX 本地） | 1024 | ~10ms | 免费 | ★★★★ |
| DeepSeek V4 API（复用 LlmGateway） | 不定 | ~200ms | 按 token | ★★ |
| OpenAI text-embedding-3-small | 512 | ~150ms | 按 token | ★★ |

**当前表结构已定 1024 维**，推荐 **BGE-large-zh-v1.5 ONNX**：
- 中文语义匹配 SOTA 级别，财务术语识别能力强
- 纯 Java ONNX Runtime，无需 Python 服务
- 模型文件 ~300MB（ONNX 量化版），放在 `resources/models/`

**实现步骤：**
1. 添加 `onnxruntime` Maven 依赖到 `agent-server-runtime/pom.xml`
2. 下载 BGE-large-zh-v1.5 ONNX 量化模型 + tokenizer
3. 实现 `BgeEmbeddingProvider`（继承 `EmbeddingProvider`）
4. 更新 `Text2SqlConfig` 支持 `bge-onnx` provider
5. 更新 `application.yml` 默认配置

**备选（快速验证）：** 先用 DeepSeek V4 API 做 Embedding（复用已有的 `LlmGateway`），后续再切 ONNX。

### Task 3.2：Text2SqlQueryAgent — 核心编排 Agent

新建 `Text2SqlQueryAgent extends AgentBase`，串联完整链路：

```
doExecute:
  1. 意图解析（LLM 轻量调用，识别问数意图）
  2. 语义检索（Text2SqlRetrievalService.retrieve）
  3. Prompt 组装（Text2SqlPromptBuilder.build）
  4. LLM 生成 SQL（callLlm）
  5. 解析 SQL（从 <sql> 标签提取）
  6. 静态校验（SqlSafetyValidator）
  7. JDBC 执行（MySqlJdbcHelper.executeQuery）
  8. 结果封装 + 存入历史
  9. 失败则纠错循环（最多 2 轮）
```

**Agent 注册：**
- `agent_code`: `text2sql-query`
- `permission_level`: 1
- `toolIds`: 无（直接调 Service，不通过 Tool 层）
- 注册到 `agent` 表 + `sys_role_agent` 授权

### Task 3.3：SqlSafetyValidator — 静态安全校验

```java
public class SqlSafetyValidator {
    /**
     * 校验规则：
     * 1. JSqlParser 解析 AST
     * 2. 必须是 SELECT（拦截 INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/EXEC/CALL）
     * 3. 提取所有表名，与检索白名单对比
     * 4. 检查是否有 LIMIT（无则自动追加 LIMIT 1000）
     * 5. 返回 ValidationResult { pass, reason, sanitizedSql }
     */
    ValidationResult validate(String sql, Set<String> allowedTables, Set<String> allowedColumns);
}
```

**依赖：** `com.github.jsqlparser:jsqlparser`（已有或新增）

### Task 3.4：JDBC 只读执行增强

`MySqlJdbcHelper` 已有基础连接能力，新增：

```java
/**
 * 执行只读 SELECT 查询。
 * @return { columns, rows, rowCount, executionMs }
 */
QueryResult executeQuery(
    String connectionId,    // 从 text2sql_data_connection 读取
    String sql,
    int timeoutSeconds,     // 默认 10s
    int maxRows             // 默认 10000
)
```

**安全措施：**
- JDBC 连接设置为只读（`conn.setReadOnly(true)`）
- PreparedStatement 参数化
- 超时 10s
- 结果集上限 10000 行
- 异常信息脱敏后返回（不暴露表结构/连接信息）

### Task 3.5：查询历史与反馈闭环

**建表：** `text2sql_query_history`（已在 Phase 1 方案第 3.3 节定义）

> 不可变审计表，仅 INSERT。

**字段：**
- `id`, `connection_id`, `user_question`, `generated_sql`, `executed_sql`
- `execution_status` (SUCCESS/FAILED/REJECTED)
- `row_count`, `duration_ms`, `error_message`
- `user_feedback` (1=有用, 0=无反馈, -1=不准确)
- `trace_id`, `question_embedding` (vector(1024), 用于相似问题检索)

**Entity + Mapper：** 按项目模板创建

**反馈如何改进系统：**
- 👍 有用 → 问题 embedding 存入 few-shot 候选池
- 👎 不准确 → 记录原因，人工审核后补充术语或修正 Schema

### Task 3.6：前端 Data Panel

在 Agent 工作台（`AgentWorkspacePage`）或新建独立页面，增加 Text2SQL 查询入口：

**交互流程：**
1. 选择数据源（Dropdown，来自已授权连接器列表）
2. 自然语言输入（TextArea）
3. 提交 → SSE 流式展示推理过程
   - `thinking` → 展示分析思路
   - `sql` → 展示生成的 SQL（可折叠）
   - `result` → 表格展示查询结果 + ECharts 图表
4. 追问支持（上下文继承）
5. 结果操作：复制 SQL、导出 Excel、👍👎 反馈

**图表自动推断：**
- 1 维度 + 1 数值 → 柱状图
- 1 时间维度 + 1 数值 → 折线图
- 1 类别 + 1 数值（≤ 10 类）→ 饼图
- 无维度或多维度 → 仅表格

### Task 3.7：RBAC 与审计

**新增权限码：**

| resource_code | Method | Path | 说明 |
|---------------|--------|------|------|
| `text2sql:query:execute` | POST | `/api/text2sql/query` | 执行自然语言查询 |
| `text2sql:query:history` | GET | `/api/text2sql/query/history` | 查询历史 |
| `text2sql:query:history:detail` | GET | `/api/text2sql/query/history/{id}` | 历史详情 |

**审计：** 每次查询记录到 `text2sql_query_history`（不可变表）+ 全链路 Trace。

---

## 4. 实施顺序

```
Task 3.1 (Embedding) ──→ Task 3.2 (Agent) ──→ Task 3.3 (校验器)
                                                │
                          Task 3.4 (JDBC 执行) ←┘
                                                │
                          Task 3.5 (历史) ←─────┘
                                                │
                          Task 3.6 (前端) ←─────┘
                                                │
                          Task 3.7 (RBAC) ←─────┘
```

**关键路径：** 3.1 → 3.2 → 3.3+3.4 → 3.5 → 3.6

**可并行：** 3.5 和 3.6 可在 3.2 开发的同时并行推进。

---

## 5. 文件清单（预计新增/修改）

### 新增文件

| 文件 | 说明 |
|------|------|
| `agent-server-runtime/.../infrastructure/embedding/BgeEmbeddingProvider.java` | BGE ONNX 实现 |
| `agent-server-runtime/.../agent/text2sql/Text2SqlQueryAgent.java` | 核心编排 Agent |
| `agent-server-runtime/.../text2sql/SqlSafetyValidator.java` | SQL 静态校验器 |
| `agent-server-system/.../entity/Text2SqlQueryHistory.java` | 查询历史 Entity |
| `agent-server-system/.../mapper/Text2SqlQueryHistoryMapper.java` | Mapper |
| `agent-server-system/resources/mapper/system/Text2SqlQueryHistoryMapper.xml` | XML |
| `agent-server-system/.../text2sql/Text2SqlQueryService.java` | 查询编排 Service |
| `agent-server-system/.../text2sql/Text2SqlQueryController.java` | `/api/text2sql/query` |
| `agent-server-system/.../text2sql/dto/Text2SqlQueryRequest.java` | 请求 DTO |
| `agent-server-system/.../text2sql/dto/Text2SqlQueryResponse.java` | 响应 DTO |
| `agent-web/src/pages/DataQueryPage.tsx` | 数据查询页面 |
| `agent-web/src/api/text2sqlQueryApi.ts` | 查询 API 封装 |
| `database/init/008_text2sql_history.sql` | 历史表 + RBAC |

### 修改文件

| 文件 | 变更 |
|------|------|
| `agent-server-system/.../config/Text2SqlConfig.java` | 新增 BGE provider 支持 |
| `agent-server-system/.../text2sql/MySqlJdbcHelper.java` | 新增 executeQuery |
| `application.yml` | 新增 `text2sql.embedding.*` 配置 |
| `agent-web/src/app/App.tsx` | 新增 DataQueryPage 路由 |
| `agent-web/src/app/AppLayout.tsx` | 新增侧边栏菜单项 |

---

## 6. 成果验证

| 里程碑 | 验证方式 |
|--------|---------|
| 真实 Embedding 可用 | `Text2SqlIndexService.buildIndex` 生成的向量索引能命中相关表 |
| Agent 编排链路通 | `POST /api/text2sql/query { "question": "本月到账金额汇总" }` 返回 SQL + 结果 |
| 校验器拦截非法 SQL | 生成 `DROP TABLE` → 返回 REJECTED |
| 纠错循环生效 | 首次 SQL 语法错误 → 自动修正 → 二次执行成功 |
| 查询历史记录 | 每次查询在 `text2sql_query_history` 中有记录 |
| 前端 Data Panel | 输入问题 → 看到表格 + 图表 + 生成 SQL |
| 反馈闭环 | 👍 存入 few-shot 候选池，相似问题命中率提升 |

---

## 7. 里程碑

| 节点 | 可验证产出 |
|------|-----------|
| Embedding 就绪 | BGE 模型加载成功，embed() 返回有效向量 |
| Agent 链路跑通 | Agent 可完整执行：检索 → Prompt → LLM → SQL |
| 校验器工作 | DROP/INSERT/DELETE 被正确拦截 |
| JDBC 执行 | SQL 在远端 MySQL 成功执行并返回结果 |
| 端到端可演示 | 前端输入自然语言 → 看到表格结果 |
| 纠错闭环 | 错误 SQL 自动修正 1 次后得到正确结果 |
