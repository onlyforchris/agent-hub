# Agent 中台技术选型与技术方案 v2.0

> 基于 `Agent中台产品方案-v1.0.md` 重新整理技术选型与实施方案。
> 关键技术决策来自 `技术评审-全部问题与决策.md`，本文档将其落地为可执行的技术方案。

---

## 1. 技术选型总览

### 1.1 后端栈

| 领域 | 选型 | 版本 | 选型理由 |
|------|------|------|----------|
| 语言 | Java | 17 (LTS) | 团队主力栈，2 人后端团队无需跨语言 |
| 框架 | Spring Boot | 3.3.5 | 生态成熟，MyBatis-Plus / Security / Web 全家桶 |
| 构建 | Maven | 3.9+ | 现有项目已配好多模块 POM |
| ORM | MyBatis-Plus | 3.5.7 | 轻量 CRUD + 自定义 SQL 混写，团队熟悉 |
| 数据库 | PostgreSQL | 16 (pgvector + TimescaleDB) | pgvector 用于 Text2SQL 向量检索，TimescaleDB 为后续时序场景预留 |
| 缓存 | Redis | 7 | JWT 黑名单 + RBAC 权限缓存 + 验证码 |
| 安全 | Spring Security 6 + 自研 JWT | — | 现有实现质量好，不动 |
| API 文档 | springdoc-openapi + Knife4j | 2.6 / 4.5 | 开发阶段用 |
| Excel | Alibaba EasyExcel | 4.0.3 | 流式读写，内存友好 |
| JSON 校验 | networknt json-schema-validator | 1.4.0 | Tool input/output schema 校验 |
| 测试 | JUnit 5 + Spring Boot Test | — | 标准方案 |

### 1.2 前端栈

| 领域 | 选型 | 版本 | 选型理由 |
|------|------|------|----------|
| 语言 | TypeScript | 5.6 | 类型安全 |
| 框架 | React | 18.3 | 生态最大，团队熟悉 |
| 构建 | Vite | 5.4 | 秒级 HMR，antd 按需加载 |
| UI 库 | Ant Design | 5.21 | 后台类产品首选，ProTable/ProLayout 省大量工作 |
| 状态管理 | Zustand | 5.0 | 轻量，比 Redux 少 90% 样板代码 |
| 服务端状态 | TanStack React Query | 5.59 | 缓存/重试/轮询开箱即用 |
| 路由 | React Router | 6.27 | 标准方案 |
| 图表 | ECharts (echarts-for-react) | 5.5 | 预测趋势图刚需 |
| Markdown | react-markdown + remark-gfm | 9.0 / 4.0 | 渲染 LLM 生成的简报 |

### 1.3 基础设施

| 领域 | 选型 | 说明 |
|------|------|------|
| 容器化 | Docker + Docker Compose | 本地开发一键拉起 PG + Redis |
| JDK 镜像 | eclipse-temurin:17-jre-alpine | 最小体积 JRE |
| 反向代理 | Nginx | 生产环境前端静态资源 + API 代理 |
| 部署形态 | 单个 fat JAR + 单容器 | 私有化部署场景，不引入 K8s |
| 浏览器兼容 | Chrome / Edge 最新两个大版本 | 内部工具，不兼容 IE |

---

## 2. 关键技术决策

### 2.1 LLM 集成

**问题：** 当前只有 MockLlmGateway，需要对接真实模型。

**选型：**

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 主模型（叙事/简报） | DeepSeek-V3 | 性价比最高，中文财务文本表现好 |
| 路由模型（Gatekeeper + AgentRouter） | DeepSeek-V3 或轻量蒸馏模型 | 分类任务不需要最强模型，降低延迟和成本 |
| 调用方式 | HTTP API (OpenAI-compatible) | DeepSeek 兼容 OpenAI 接口，无需额外 SDK |
| 网关设计 | LlmGateway 接口 + 可插拔 Provider | 预留切换能力，但不做过度抽象 |

**LlmGateway 设计（重写 Mock 实现）：**

```java
public interface LlmGateway {
    /**
     * 对话补全（多轮）
     * @param provider  模型提供商，如 "deepseek"
     * @param model     模型名，如 "deepseek-v3"
     * @param messages  消息列表
     * @param options   可选参数（temperature、max_tokens、response_format 等）
     */
    LlmResult chat(String provider, String model,
                   List<Message> messages, LlmOptions options);

    /**
     * 单轮补全（分类/路由用，延迟优先）
     */
    String complete(String provider, String model,
                    String systemPrompt, String userInput);
}
```

- 一期实现：`DeepSeekLlmGateway`（HTTP client + 连接池）
- 保留 `MockLlmGateway` 仅用于单元测试
- 超时：路由 5s，叙事 30s，通过 `LlmOptions` 配置
- 错误处理：网络超时重试 1 次，模型返回异常记录 audit 后降级为 mock 回复（仅开发环境）

**Prompt 模板管理：**

- 一期：Prompt 以字符串常量写在 Agent 代码中（或 classpath:prompts/*.md 文件）
- 二期：若 Prompt 复用明显，迁移到数据库表 `sys_prompt_template`，管理后台编辑

### 2.2 SSE 流式输出

**问题：** 对话式交互需要服务端推送 AI 回复和步骤进度。

**选型：** **SSE (Server-Sent Events)**，不用 WebSocket。

理由：
- 一期只有服务端→客户端单向推送（AI 回复流 + trace 步骤进度）
- SSE 天然支持断线重连（EventSource API）
- 不需要双向通信（用户输入走普通 POST）
- 穿过代理/Nginx 时 SSE 比 WebSocket 更省配置

```java
// AgentController
@PostMapping(value = "/api/agent/ask", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<AgentStreamEvent>> ask(@RequestBody AskRequest request) {
    return agentRouter.route(request)
        .flatMapMany(agent -> agent.executeStreaming(intent, ctx));
}

// AgentBase 提供流式执行骨架
protected Flux<AgentStreamEvent> executeStreaming(Intent intent, SessionContext ctx) {
    return Flux.concat(
        Flux.just(stepEvent("routing", "匹配到Agent: " + info().name())),
        doExecuteStreaming(intent, ctx), // 子类实现，每个步骤 emit 事件
        Flux.just(completeEvent(result))
    );
}
```

前端 `useTraceStream` hook（已有基础，需增强）：
- `EventSource` 监听 `/api/agent/ask`
- 步骤事件 → 左侧步骤列表实时更新
- AI 回复事件 → 右侧 Markdown 流式渲染
- 完成事件 → 展示最终结果 + 快捷操作按钮

### 2.3 Agent 基座架构

**决策：** 两层架构，不是五层。

```
┌─────────────────────────────────────┐
│  平台层（agent-server-runtime）      │
│                                     │
│  AgentBase (final execute 骨架)      │
│  AgentRouter (Gatekeeper + 路由)     │
│  ToolExecutor (工具注册/调用/权限)    │
│  LlmGateway (模型路由/模板/校验)      │
│  AuditService (Trace 落库持久化)     │
│  RBAC (认证/授权，已有)              │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  垂直层（各 Agent 独立 package）     │
│                                     │
│  cashflow/                          │
│    CashflowAgent extends AgentBase  │
│    ForecastEngine (预测算法)        │
│    CashflowValidator (数据校验)     │
│                                     │
│  fx/          (二期)                │
│  scheduling/  (二期)                │
└─────────────────────────────────────┘
```

**AgentBase 最终设计：**

```java
public abstract class AgentBase {

    // —— 子类必须实现 ——
    public abstract AgentInfo info();
    public abstract Intent classify(String input, SessionContext ctx);
    public abstract AgentResult doExecute(Intent intent, SessionContext ctx);

    // —— 子类可选覆盖 ——
    public String routeHint()       { return info().description(); }
    public String preferredModel()  { return "deepseek-v3"; }
    public List<String> toolIds()   { return List.of(); }

    // —— 平台能力（final，不可覆写）——
    public final AgentResult execute(Intent intent, SessionContext ctx) {
        TraceRecord trace = traceService.start(info().id(), intent, ctx);
        try {
            // 权限校验
            accessControl.checkAgentAccess(ctx.userId(), info().permissionLevel());
            // 执行业务
            AgentResult result = doExecute(intent, ctx);
            trace.success(result);
            return result;
        } catch (Exception e) {
            trace.fail(e);
            throw e;
        } finally {
            auditService.record(trace);
        }
    }

    // —— 子类调用的平台能力 ——
    protected ToolResult callTool(String key, Map<String, Object> params);
    protected LlmResult callLlm(String promptKey, Map<String, Object> vars);
    protected void audit(String action, Map<String, Object> detail);
}
```

### 2.4 意图路由

**决策：** 两层 LLM 路由，替换现有的硬编码 IntentClassifier。

```
用户输入 ──→ Gatekeeper (1次 LLM, fast model)
                │
                ├─ type=chat  ──→ 纯对话通道（不触发 Agent）
                │
                └─ type=task  ──→ AgentRouter (1次 LLM, fast model)
                                      │
                                      ├─ 匹配成功 ──→ 对应 Agent.classify() → doExecute()
                                      │
                                      └─ 匹配失败 ──→ 引导回复 + 前端展示 Agent chip
```

```java
@Service
public class AgentRouter {

    public record RoutingResult(AgentBase agent, Intent intent, String reasoning) {}

    public RoutingResult route(String userInput, SessionContext ctx) {
        // 1. Gatekeeper: 是不是任务型对话？
        GatekeeperDecision gk = gatekeeper.classify(userInput);
        if (gk.type() == GateType.CHAT) {
            return chatReply(userInput);
        }

        // 2. AgentRouter: 匹配到哪个 Agent？
        String agentId = llmRouter.match(userInput, allAgentHints());
        if (agentId == null || !agentRegistry.contains(agentId)) {
            return suggestAgent(userInput);
        }

        // 3. 委托给 Agent 做细粒度意图分类
        AgentBase agent = agentRegistry.get(agentId);
        Intent intent = agent.classify(userInput, ctx);
        return new RoutingResult(agent, intent, gk.reasoning());
    }
}
```

**Fallback 策略：**
1. Gatekeeper 判定为闲聊 → 走通用对话通道，不触发 Agent
2. AgentRouter 匹配度低于阈值 → 引导用户选择 Agent
3. LLM 调用超时 → 降级为最近使用的 Agent（session 级别记忆）

### 2.5 预测引擎

**决策：** 预测计算不放 Tool 层，作为 CashflowAgent 的私有领域类。

```java
// 属于 cashflow package，不注册为 Tool
public class ForecastEngine {

    /**
     * 执行13周滚动现金流预测
     * @param entries    TMS 分类账条目
     * @param config     预测参数（历史窗口、周期模式等）
     */
    public ForecastResult forecast(List<LedgerEntry> entries, ForecastConfig config) {
        // 1. 按科目分组（经营/融资/投资 × 流入/流出）
        Map<Category, List<LedgerEntry>> grouped = groupByCategory(entries);

        // 2. 计算历史每周各类别日均值
        Map<Integer, WeeklyStats> weeklyStats = computeWeeklyStats(grouped, config.historyWeeks());

        // 3. 识别周期性模式（月度/季度/年度）
        List<CyclePattern> cycles = detectCycles(weeklyStats);

        // 4. 生成13周滚动预测
        List<WeekForecast> weeks = generateForecast(weeklyStats, cycles, config);

        // 5. 标注缺口周
        return new ForecastResult(weeks, identifyGaps(weeks), computeConfidence(weeks, cycles));
    }

    // 一期算法：移动平均 + 周期性因子
    // 优势：口径明确、计算可追溯、结果可解释
    private List<WeekForecast> generateForecast(...) { ... }
    private List<CyclePattern> detectCycles(...) { ... }
}
```

**算法选型（一期）：移动平均 + 周期性因子**

| 方案 | 可行性 | 一期选它？ |
|------|--------|:----------:|
| 移动平均 + 周期因子 | 数据量小时可用，口径明确可解释 | ✅ |
| ARIMA / SARIMA | 需要至少 2-3 年周级别数据，可解释性差 | ❌ |
| Prophet (Meta) | Python 依赖，需要 Python sidecar | ❌ |
| LLM 直接生成预测数值 | 不可靠、不可重复、幻觉风险 | **禁止** |

**二期考虑：** 如果客户数据积累到 52 周+ 且对精度有更高要求，评估 Prophet 或自研趋势分解模型。

### 2.6 数据连接

**决策：** 直连 TMS 数据库，只读账号，视图隔离。

```
┌─────────────┐     只读账号 + 视图        ┌──────────────┐
│  Agent 服务  │ ──────────────────────────→│  TMS 数据库   │
│  (8066)     │   jdbc:postgresql://...     │              │
└─────────────┘   v_tms_ledger              └──────────────┘
                  v_tms_accounts
                  v_tms_payables_receivables
```

安全约束：
- 独立只读数据库账号，密码通过环境变量 `TMS_DB_PASSWORD` 注入
- Agent 通过视图访问，视图定义过滤已删除/作废数据
- Agent 代码不写、不改、不删 TMS 数据
- 密码不出现在配置文件、日志、trace 中

一期改造 `LedgerFetchTool`：
- 删除假数据返回
- 注入 MyBatis 只读 Mapper（TMS 数据源）
- SQL 通过视图查询，不直接访问基表

### 2.7 Trace/Audit 设计

**决策：** 重写 AuditLogService，trace 落 PostgreSQL 持久化。

```sql
-- 已有的 execution_trace 表（结构保留，增强字段）
CREATE TABLE execution_trace (
    id              VARCHAR(36) PRIMARY KEY,
    agent_id        VARCHAR(64)  NOT NULL,
    intent          VARCHAR(64),
    user_id         VARCHAR(36),
    session_id      VARCHAR(36),
    input_text      TEXT,
    status          VARCHAR(20)  NOT NULL, -- RUNNING, SUCCESS, FAILED
    error_message   TEXT,
    started_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP,
    metadata        JSONB,                -- 扩展字段：模型名、耗时、token 数
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- execution_step 已存在，保留
CREATE TABLE execution_step (
    id              VARCHAR(36) PRIMARY KEY,
    trace_id        VARCHAR(36)  NOT NULL REFERENCES execution_trace(id),
    step_order      INT          NOT NULL,
    step_type       VARCHAR(32)  NOT NULL, -- TOOL / LLM / RULE
    step_key        VARCHAR(128),
    input_data      JSONB,
    output_data     JSONB,
    status          VARCHAR(20)  NOT NULL,
    error_message   TEXT,
    duration_ms     BIGINT,
    started_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMP
);
```

- 每次 Agent 执行生成一条 `execution_trace`，每个步骤（调 Tool / 调 LLM / 校验）生成一条 `execution_step`
- LLM step 额外记录：model、prompt_key、input_tokens、output_tokens
- Tool step 额外记录：tool_key、调用参数、返回数据摘要
- `AgentBase.execute()` final 骨架统一管理 trace 生命周期，Agent 开发者无感
- 一期不做 trace 回放界面（二期评估）

### 2.8 权限模型

**决策：** 保留现有 RBAC，不做三维交叉。

一期权限覆盖：
- 用户 → 角色 → 菜单/资源权限（已有，不动）
- Agent 声明 `permissionLevel()`（1-5），执行时校验用户角色是否达标
- Agent 可见范围：管理员在后台配置哪些角色可看到/使用该 Agent
- 不做：人→Agent 的细粒度独立绑定

```java
public class AgentInfo {
    String id;
    String name;
    String description;
    int permissionLevel;  // 1-5，用户角色级别 >= 此值才能用
    List<String> visibleRoles; // 为空 = 所有角色可见
}
```

### 2.9 Excel 报表

**决策：** EasyExcel 流式生成，模板化。

- 预测报表模板：Summary 页（汇总 + 简报文字）+ Weekly Detail 页（13 周明细）+ 数据来源页
- Excel 生成在服务端完成（ForecastEngine 输出结构化数据 → EasyExcel 填充模板）
- 通过 REST 接口下载（`GET /api/agent/cashflow/export?sessionId=xxx`）
- 不做在线 Excel 预览编辑（浏览器下载后用本地 Excel）

---

## 3. 模块设计

### 3.1 后端模块重组

```
agent-server/
├── agent-server-common/        # 跨模块共享（保留，微调）
│   ├── exception/              # BusinessException, GlobalExceptionHandler
│   ├── response/               # R<T>, AgentResponse<T>
│   ├── security/               # AccessControlService 接口
│   └── trace/                  # TraceIdFilter
│
├── agent-server-system/        # 认证 + RBAC（保留，不动）
│   ├── config/                 # SecurityConfig, RbacSecurityProperties
│   ├── controller/             # Auth, User, Role, Menu, Resource, Agent 管理
│   ├── entity/                 # 数据库实体
│   ├── mapper/                 # MyBatis Mapper
│   ├── security/               # JWT Filter, RBAC Filter
│   └── service/                # Auth, Rbac, Token, Captcha
│
├── agent-server-runtime/       # Agent 运行时（重大改造）
│   ├── base/                   # ★ 新增：AgentBase 抽象基类
│   ├── router/                 # ★ 新增：AgentRouter + Gatekeeper
│   ├── tool/                   # ToolHandler 接口 + ToolExecutor（保留）
│   ├── llm/                    # ★ 重写：LlmGateway 接口 + DeepSeekLlmGateway
│   ├── audit/                  # ★ 重写：TraceService + AuditService 持久化
│   ├── agent/                  # ★ 新增：垂直 Agent 实现
│   │   └── cashflow/           #
│   │       ├── CashflowAgent   # AgentBase 子类
│   │       ├── ForecastEngine  # 预测算法核心
│   │       └── CashflowValidator # 数据校验
│   └── controller/             # AgentController（改造自 OrchestratorController）
│
├── agent-server-app/           # 启动模块（保留）
│   └── resources/
│       ├── application.yml
│       ├── prompts/            # ★ 新增：Prompt 模板文件
│       │   ├── cashflow-forecast-briefing.md
│       │   ├── cashflow-explain.md
│       │   └── gatekeeper.md
│       └── db/
│           └── migration/      # SQL 迁移脚本
│
└── agent-server-infrastructure/ # ★ 新增（可选）：跨模块基础设施
    └── tms/                    # TMS 数据源配置 + 只读 Mapper
```

### 3.2 删除清单

| 类/文件 | 原因 |
|---------|------|
| `IntentClassifier.java` | 被 LLM AgentRouter 替代 |
| `SkillExecutor.java` | Skill 概念取消 |
| `SkillRegistry.java` | YAML 加载逻辑取消 |
| `RuleEngine.java` | 业务规则回归 Agent |
| `MockLlmGateway.java` | 被 DeepSeekLlmGateway 替代 |
| `OrchestratorService.java` | 被 AgentRouter 替代 |
| `OrchestratorController.java` | 被 AgentController 替代 |
| `classpath:skills/*.yaml` (3 个) | YAML DSL 取消 |
| `ComputeStatsTool.java` | 逻辑合并进 ForecastEngine |
| `SkillDefinition/SkillMeta/SkillStep` 等 record | Skill 概念取消 |

### 3.3 新增清单

| 类/文件 | 说明 |
|---------|------|
| `AgentBase.java` | Agent 抽象基类（final execute 骨架） |
| `AgentRouter.java` | LLM 驱动的路由 + Gatekeeper |
| `StreamingAgentBase.java` | SSE 流式 Agent（AgentBase 子类） |
| `DeepSeekLlmGateway.java` | DeepSeek HTTP API 适配 |
| `TraceService.java` | Trace 记录持久化 |
| `CashflowAgent.java` | 现金流预测 Agent |
| `ForecastEngine.java` | 预测算法核心 |
| `CashflowValidator.java` | 数据完整性校验 |
| `AgentController.java` | Agent 对话接口（替代 OrchestratorController） |
| `prompts/*.md` | Prompt 模板文件 |

### 3.4 前端页面重组

一期 3 页：

| 页面 | 路由 | 说明 |
|------|------|------|
| 对话工作台 | `/workspace` | Agent 标签 + 对话列表 + SSE 流式回复 + 快捷操作 |
| 预测看板 | `/forecast/:sessionId` | 趋势图(ECharts) + 13周明细表 + 简报文字 + 导出 |
| 管理后台 | `/admin` | RBAC（已有）+ Agent 管理（L1 配置） |

删除页面：`/skills`、`/tools`、`/audit`

---

## 4. 核心接口设计

### 4.1 Agent 对话接口

```
POST /api/agent/ask
Content-Type: application/json
Accept: text/event-stream

Request:
{
    "input": "帮我做未来13周的现金流预测",
    "agentId": null,        // 可选，指定 Agent
    "sessionId": "xxx"      // 会话 ID
}

Response (SSE stream):
event: step
data: {"type":"routing","message":"正在匹配处理模块...","agent":"cashflow"}

event: step
data: {"type":"tool_call","message":"正在拉取TMS分类账数据...","tool":"ledger.fetch"}

event: step
data: {"type":"computation","message":"正在计算13周滚动预测..."}

event: step
data: {"type":"llm","message":"正在生成预测简报..."}

event: token
data: {"text":"好的，我来为您生成13周现金流预测报告...\n\n**预测摘要**\n\n"}

event: token
data: {"text":"- 预测周期：2026-05-05 至 2026-08-03\n"}

event: complete
data: {
    "reply": "...",
    "result": {
        "type": "forecast",
        "data": { "weeks": [...], "summary": {...} },
        "actions": [
            { "label": "查看完整看板", "type": "navigate", "url": "/forecast/xxx" },
            { "label": "下载Excel报表", "type": "download", "url": "/api/agent/cashflow/export" }
        ],
        "traceId": "xxx"
    }
}
```

### 4.2 Agent 管理接口（L1，复用现有 RBAC controller）

```
GET    /api/rbac/agents              # Agent 列表（名称、描述、状态、权限级别）
PUT    /api/rbac/agents/{id}         # 编辑基本信息（名称、描述、图标）
PUT    /api/rbac/agents/{id}/scope   # 配置可见范围（哪些角色/用户可用）
PUT    /api/rbac/agents/{id}/status  # 启用/禁用
```

### 4.3 预测看板数据接口

```
GET /api/agent/cashflow/forecast/{sessionId}
Response:
{
    "forecastPeriod": { "start": "2026-05-05", "end": "2026-08-03" },
    "initialBalance": 12580000,
    "weeks": [
        { "week": 1, "inflow": 5200000, "outflow": 3800000, "net": 1400000, "balance": 13980000 },
        ...
    ],
    "gaps": [{ "week": 7, "deficit": 2340000 }],
    "chartConfig": { ... },  // ECharts option，或由前端自行拼装
    "briefing": "根据过去12周的资金流水分析...",
    "dataSource": "TMS · 2026-05-05 08:30 更新"
}
```

### 4.4 Excel 导出接口

```
GET /api/agent/cashflow/export?sessionId=xxx&format=xlsx
Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="现金流预测_2026-05-05.xlsx"
```

---

## 5. 部署架构

### 5.1 开发环境

```
┌────────────────────────────────────────┐
│  docker-compose up -d                  │
│                                        │
│  ┌──────────┐  ┌──────────┐           │
│  │ PG 16    │  │ Redis 7  │           │
│  │ :5432    │  │ :6379    │           │
│  └──────────┘  └──────────┘           │
└────────────────────────────────────────┘

┌────────────────┐  ┌────────────────┐
│ agent-server   │  │ agent-web      │
│ mvn spring-boot│  │ npm run dev    │
│ :8066          │  │ :3006          │
└────────────────┘  └────────────────┘
        │                   │
        └───────┬───────────┘
                │ Vite proxy: /api → :8066
                ▼
           浏览器 :3006
```

### 5.2 生产部署（私有化）

```
┌─────────────────────────────────────────────┐
│  客户服务器                                   │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  Nginx (:80 / :443)                   │   │
│  │  ├─ /           → agent-web 静态文件  │   │
│  │  └─ /api/*      → agent-server :8066  │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │ PG 16    │ │ Redis 7  │ │ Agent JAR │   │
│  │ :5432    │ │ :6379    │ │ :8066     │   │
│  └──────────┘ └──────────┘ └───────────┘   │
│                                             │
│  ┌──────────┐                               │
│  │ TMS DB   │ (客户已有，只读)              │
│  └──────────┘                               │
└─────────────────────────────────────────────┘
```

- Agent Server 打包为 `efloow-agent-server-app-0.1.0.jar`，`java -jar` 启动
- 前端 `npm run build` 产出静态文件，Nginx 直接 serve
- 配置文件外挂：`--spring.config.location=/etc/efloow/application.yml`
- 敏感信息通过环境变量注入，不出现在配置文件中

---

## 6. M1 实施步骤

总工期预估：**6 周**（2 个后端 + 1 个前端）

### 第 1 周：基础设施 + 基座改造

| 任务 | 产出 | 负责 |
|------|------|------|
| 删除 SkillExecutor/SkillRegistry/RuleEngine/IntentClassifier | 清理后的 runtime 模块 | 后端 |
| 写 AgentBase、AgentRouter、Gatekeeper | 基座核心类 | 后端 |
| 实现 DeepSeekLlmGateway | 真实 LLM 调用通路 | 后端 |
| 重写 AuditService → TraceService 落库 | trace 持久化 | 后端 |
| AgentController 替代 OrchestratorController | 新对话接口 | 后端 |

### 第 2 周：现金流 Agent 核心

| 任务 | 产出 | 负责 |
|------|------|------|
| ForecastEngine（移动平均 + 周期因子） | 预测算法 | 后端 |
| CashflowAgent（classify + doExecute） | Agent 实现 | 后端 |
| TMS 视图定义 + LedgerFetchTool 改造（真数据） | 数据连接 | 后端 |
| 预测看板数据接口 | REST API | 后端 |

### 第 3 周：对话体验 + SSE

| 任务 | 产出 | 负责 |
|------|------|------|
| SSE 流式输出（步骤 + token + 完成事件） | 流式对话接口 | 后端 |
| Prompt 模板（gatekeeper / briefing / explain） | 模板文件 | 后端 |
| 前端工作台：Agent 标签切换 + SSE 消费 | 对话页改造 | 前端 |
| 前端流式 Markdown 渲染 | 回复区 | 前端 |

### 第 4 周：预测看板 + 报表

| 任务 | 产出 | 负责 |
|------|------|------|
| Excel 导出（EasyExcel 模板填充） | 导出接口 | 后端 |
| 前端预测看板页（ECharts 趋势图 + 明细表 + 简报） | 看板页 | 前端 |
| L1 Agent 管理（管理后台：编辑/权限/启用禁用） | 管理后端 | 后端 |
| 管理后台 Agent 管理页 | 管理前端 | 前端 |

### 第 5 周：联调 + 边界处理

| 任务 | 产出 | 负责 |
|------|------|------|
| 端到端联调（对话→预测→看板→导出） | 完整链路 | 全员 |
| 错误场景处理（TMS 无数据、数据不全、LLM 超时） | 边界兜底 | 后端 |
| 权限校验端到端（无权限用户不能使用 Agent） | 权限通路 | 后端 |
| 前端 loading / empty / error 三种状态 | 状态覆盖 | 前端 |

### 第 6 周：验证 + 演示准备

| 任务 | 产出 | 负责 |
|------|------|------|
| 预测结果一致性验证（同一输入→同一数值） | 验收通过 | 后端 |
| LLM 简报内容约束验证（不编造数据） | 验收通过 | 后端 |
| 部署文档 + docker-compose 生产配置 | 部署指南 | 后端 |
| 用户试用准备（演示数据 + 操作说明） | 演示环境 | 全员 |

---

## 7. 技术风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|:----:|:----:|------|
| DeepSeek API 不稳定/延迟高 | 中 | 高 | LlmGateway 内置超时重试 + 降级提示；评估备用模型（通义千问） |
| TMS 数据质量差（缺字段、日期不连续） | 高 | 中 | CashflowValidator 明确报错信息，指出缺失项，引导用户联系管理员 |
| 预测算法偏差大 | 中 | 中 | 一期明确口径为"趋势参考"而非"精确预测"；与财务团队确认可接受偏差范围 |
| 私有化部署客户环境差异大 | 中 | 低 | 外挂配置 + 环境变量注入；Docker 化交付 |
| 两个后端吞吐量瓶颈 | 低 | 低 | 一期内部用户 < 50，无并发压力；后续按需扩展 |

---

## 8. 二期技术预览

M1 完工后，二期评估下列技术事项：

- **L2 查询型 Agent 配置：** `ConfiguredAgent extends AgentBase`，通用单步调用模板，管理后台表单创建
- **更多数据源：** 外汇系统、排程系统、账户流水系统
- **Trace 回放界面：** 管理员/开发者查看历史 trace 详情，辅助排查和审计
- **Prompt 管理后台：** Prompt 模板从代码迁移到数据库，管理后台在线编辑
- **模型评估框架：** 对比不同模型在 routing / briefing 任务上的质量指标
- **多租户：** 如果 SaaS 化，评估租户隔离方案（库级别 vs schema 级别）

---

*本文档 v2.0，基于产品方案 v1.0 和评审决策编写。后续技术变更请同步更新。*
