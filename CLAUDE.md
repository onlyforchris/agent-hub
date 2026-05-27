# Agent 中台 v2.0 — 项目规则

> 适用范围：全项目前后端。架构已从 v1.0 (Skill YAML DSL) 重构为 v2.0 (AgentBase + Java 代码直写)。
> 适用对象：研发人员、AI 辅助编码工具（Claude Code / Cursor）、代码评审。

---

## 0. 架构核心（不可变）

1. 编排链路：`AgentController → AgentRouter(LLM) → AgentBase.execute() → doExecute(Java代码) → Tool/LLM`
2. 不再有 Skill YAML DSL、SkillRegistry、SkillExecutor、RuleEngine、IntentClassifier 硬编码
3. Agent 流程以 Java 代码直写（`AgentBase.doExecute()`），不经过 YAML 或可视化编排
4. 每个 Agent 是 `AgentBase` 的子类，自控流程、自定 Prompt、自写领域逻辑
5. 平台层提供：`AgentBase`(final execute 骨架)、`ToolExecutor`、`LlmGateway`、`TraceService`、RBAC
6. 垂直层：每个 Agent 一个 Java package，如 `agent/cashflow/`
7. 一期唯一 Agent：`CashflowAgent`（现金流预测），后续扩展 FX/排程等

---

## 1. 固定技术栈

### 1.1 后端

**必须使用：**
- Java 17
- Spring Boot 3.3.5
- Maven 多模块（common / system / runtime / app）
- PostgreSQL 16（需启用 pgvector + TimescaleDB 扩展，见 1.1.1 Docker 基础设施）
- Redis 7
- MyBatis-Plus 3.5.7
- Spring Security 6 + 自研 JWT (HS256)
- springdoc-openapi 2.6 + Knife4j 4.5
- EasyExcel 4.0.3
- Jackson
- Logback + MDC
- WebClient（外部 HTTP 调用）

### 1.1.1 Docker 基础设施

**PostgreSQL 镜像：** 基于 `pgvector/pgvector:pg16`（Debian 12）+ apt 加装 TimescaleDB。

```dockerfile
# docker/Dockerfile.postgres
FROM pgvector/pgvector:pg16
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-timescaledb \
    && rm -rf /var/lib/apt/lists/*
RUN echo "shared_preload_libraries = 'timescaledb'" \
    >> /usr/share/postgresql/postgresql.conf.sample
```

**构建与启动：**
```bash
# 构建镜像
docker build -f docker/Dockerfile.postgres -t efloow-postgres:16 .

# 首次启动（含初始化 SQL）
docker run -d --name efloow-agent-postgres \
  -p 127.0.0.1:5431:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=efloow2026pg \
  -e POSTGRES_DB=efloow_agent \
  -v $(pwd)/docker/init.sql:/docker-entrypoint-initdb.d/init.sql \
  efloow-postgres:16 \
  -c shared_preload_libraries='timescaledb'

# 后续启动
docker start efloow-agent-postgres
```

**说明：**
- 两个扩展均从 PGDG 官方 apt 仓库安装，无需编译或第三方源
- TimescaleDB 要求 `shared_preload_libraries`，pgvector 不需预加载
- `docker/init.sql` 在首次创建数据库时自动执行 `CREATE EXTENSION`
- 镜像体积 ~641MB（vs TimescaleDB HA 镜像 7.6GB）
- 扩展版本：pgvector 0.8.x / TimescaleDB 2.x（跟随 PGDG 仓库更新）

**禁止引入：**
- LangChain / LangChain4j / LangGraph / LlamaIndex / Semantic Kernel / CrewAI / AutoGen
- Spring AI（暂缓）
- Kafka / Kubernetes（M1 不需要）
- NestJS

### 1.2 前端

**必须使用：**
- React 18 (函数组件)
- TypeScript 5
- Vite 5
- Ant Design 5
- React Router 6
- Zustand 5
- TanStack React Query 5
- Axios
- ECharts 5
- react-markdown 9

**禁止：**
- 引入 Vue / Pinia
- Class Component
- 组件中直接拼接 Base URL
- 组件中散落请求逻辑
- 硬编码字典颜色/状态映射

---

## 2. 时间字段规范（全局强制）

### 2.1 数据库

所有时间字段必须使用 **无时区** 类型：

```sql
"create_time"  timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
"update_time"  timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
"started_at"   timestamp(6),
"completed_at" timestamp(6),
"expire_time"  timestamp(6),
"request_time" timestamp(6),
"last_login_time" timestamp(6),
```

**强制规则：**
- 时间列类型统一用 `timestamp(6)`（不带时区）
- 默认值统一用 `LOCALTIMESTAMP(6)`（不用 `now()`）
- MyBatis XML 中 `now()` → `LOCALTIMESTAMP(6)`

**绝对禁止：**
- `timestamptz` / `timestamptz(6)`
- `now()` 作为默认值
- `CURRENT_TIMESTAMP`

### 2.2 Java

- 所有时间字段、变量、参数统一用 `java.time.LocalDateTime`
- MyBatis Mapper 接口参数也用 `LocalDateTime`

**绝对禁止：**
- `java.time.OffsetDateTime`
- `java.time.ZonedDateTime`
- `java.time.ZoneOffset`
- `java.util.Date`
- `java.sql.Timestamp`

JWT `exp` claim 转换方式：
```java
LocalDateTime.ofInstant(Instant.ofEpochSecond(exp.longValue()), ZoneId.systemDefault())
```

### 2.3 输出格式

全局统一：`yyyy-MM-dd HH:mm:ss`（`LocalDateTime.toString()` 默认输出）

---

## 3. 数据库规范

### 3.1 表公共字段（所有表必须包含）

每张业务表必须包含以下公共字段，按固定顺序排列：

```sql
CREATE TABLE IF NOT EXISTS "public"."table_name" (
    "id"          text COLLATE "pg_catalog"."default" NOT NULL,
    -- 业务字段 --
    "status"      int4 NOT NULL DEFAULT 1,
    "remark"      text COLLATE "pg_catalog"."default",
    "create_by"   text COLLATE "pg_catalog"."default",
    "create_time" timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    "update_by"   text COLLATE "pg_catalog"."default",
    "update_time" timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT "table_name_pkey" PRIMARY KEY ("id")
);
```

**字段说明：**

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| `id` | `text` | 是 | — | 主键，应用层生成全局唯一 ID |
| `status` | `int4` | 是 | `1` | 0=暂存, 1=正常, 2=删除 |
| `remark` | `text` | 否 | — | 备注 |
| `create_by` | `text` | 否 | — | 创建人 |
| `create_time` | `timestamp(6)` | 是 | `LOCALTIMESTAMP(6)` | 创建时间 |
| `update_by` | `text` | 否 | — | 更新人 |
| `update_time` | `timestamp(6)` | 是 | `LOCALTIMESTAMP(6)` | 更新时间 |

### 3.2 字段命名

- 表名/字段名：`lower_snake_case`
- 主键统一用 `id`
- 父子结构统一用 `parent_id`，根节点默认 `'0'`
- 禁止混用 `created_at` / `create_time`、`updated_at` / `update_time`

### 3.3 逻辑删除

- 所有业务表统一用 `status` 字段做逻辑删除
- `status = 0`：暂存（草稿）
- `status = 1`：正常
- `status = 2`：删除
- 禁止额外创建 `deleted`、`is_deleted`、`del_flag`、`is_valid` 等字段
- 业务删除操作 UPDATE status=2，禁止物理 DELETE
- 默认查询必须过滤 `status <> 2`

#### 3.3.1 不可变表（审计/日志/流水）变体

不可变表仍然遵循 3.1 模板（包含全部公共字段），但语义有调整：

| 公共字段 | 业务表 | 不可变审计表 |
|----------|--------|-------------|
| `status` | 0=暂存, 1=正常, 2=删除 | 0=失败/异常, 1=成功/正常（非逻辑删除） |
| `remark` | 备注 | 同左 |
| `create_by` | 创建人 | 同左 |
| `create_time` | 创建时间 | 同左 |
| `update_by` | 更新人 | **始终为空**（仅 INSERT，无 UPDATE） |
| `update_time` | 更新时间 | **始终为默认值**（仅 INSERT，无 UPDATE） |

**不可变表额外约束：**
- 仅允许 INSERT，禁止 UPDATE / DELETE
- 查询不需要过滤 `status <> 2`（不存在逻辑删除）
- 表 COMMENT 和 `update_by`/`update_time` 的 COMMENT 中必须标注"不可变表"

### 3.4 COMMENT 注释（所有表/字段必须）

每张表和每个字段必须紧跟 `COMMENT ON` 注释：

```sql
COMMENT ON TABLE "public"."table_name" IS '表说明';
COMMENT ON COLUMN "public"."table_name"."id" IS '主键 ID';
COMMENT ON COLUMN "public"."table_name"."status" IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN "public"."table_name"."create_time" IS '创建时间';
```

状态/类型/枚举字段必须在 COMMENT 中写明取值口径。

### 3.5 JSONB 使用

适合 JSONB 的场景：
- Tool 输入参数 / 输出结果
- LLM request / response payload
- clientActions
- Trace step payload
- execution_trace.outputs

禁止：
- 把高频查询字段塞进 JSONB
- 把所有业务字段都放 JSONB

### 3.6 通用约束

- `id` 类型默认 `text`，应用层生成 UUID
- JSON 字段统一用 `JSONB`
- 大文本用 `TEXT`
- 禁止 `SELECT *`
- 禁止 Java 代码拼接 SQL 字符串
- 禁止循环内逐条查询
- 审计日志表只允许 INSERT，禁止 UPDATE/DELETE

---

## 4. 后端分层约束

### 4.1 目录结构

```
agent-server/
├── agent-server-app/            # 启动模块（只放启动类 + application.yml）
├── agent-server-common/         # 公共模块（R, AgentResponse, BusinessException, TraceIdFilter）
├── agent-server-system/         # 系统模块（RBAC: 用户/角色/菜单/资源/Agent管理）
└── agent-server-runtime/        # Agent 运行时
    ├── base/                    # AgentBase 抽象基类
    ├── router/                  # AgentRouter + Gatekeeper
    ├── agent/                   # 垂直 Agent 实现（每个 Agent 一个 package）
    │   └── cashflow/            #   CashflowAgent, ForecastEngine, CashflowValidator
    ├── application/
    │   ├── llm/                 # LlmGateway 接口
    │   ├── tool/                # ToolExecutor
    │   └── audit/               # TraceService
    ├── domain/
    │   ├── agent/               # AgentInfo, Intent, AgentResult, SessionContext, AgentStreamEvent
    │   ├── tool/                # ToolHandler, ToolResult
    │   └── trace/               # TraceRecord, TraceStep
    ├── infrastructure/
    │   ├── llm/                 # DeepSeekLlmGateway, MockLlmGateway
    │   └── tool/                # Tool 实现类（LedgerFetchTool 等）
    ├── controller/              # AgentController, ToolController
    └── resources/
        └── prompts/             # Prompt 模板文件
```

### 4.2 分层规则

| 层 | 允许 | 禁止 |
|----|------|------|
| Controller | 路由、参数校验、调用 AgentRouter | 写业务逻辑、直接调 Mapper、直接调 LLM API |
| Agent (doExecute) | 调 Tool、调 LLM、领域计算、if/else 分支 | — |
| Tool | 无状态查询、调外部系统、返回 ToolResult | 调 LLM、互相调用 |
| LlmGateway | HTTP 调模型、超时重试 | 写业务判断 |

- `@Transactional` 方法内禁止调 LLM 或外部 HTTP
- 事务边界必须尽量短

---

## 5. Agent 开发规范

```java
@Component
public class MyAgent extends AgentBase {

    @Override
    public AgentInfo info() {
        return AgentInfo.builder()
            .id("myagent")
            .name("Agent 名称")
            .description("Agent 描述")
            .permissionLevel(1)
            .skills(List.of(
                new SkillInfo("action1", "能力名称", "能力描述")
            ))
            .toolIds(List.of("tool.key"))
            .build();
    }

    @Override
    public String routeHint() {
        return "用于 LLM 路由匹配的中文描述";
    }

    @Override
    public String preferredModel() {
        return "deepseek-v3";
    }

    @Override
    public Intent classify(String input, SessionContext ctx) {
        // 意图分类：forecast / explain / export / chat
        if (input.contains("预测")) return new Intent("forecast");
        if (input.contains("解释")) return new Intent("explain");
        if (input.contains("导出")) return new Intent("export");
        return new Intent("chat");
    }

    @Override
    public AgentResult doExecute(Intent intent, SessionContext ctx) {
        return switch (intent.action()) {
            case "forecast" -> doForecast(ctx);
            case "explain"  -> doExplain(intent, ctx);
            case "export"   -> doExport(intent, ctx);
            default         -> doChat(intent, ctx);
        };
    }
}
```

**规则：**
- `AgentBase.execute()` 是 final 骨架：权限校验 → doExecute → trace 记录 → 异常兜底
- Agent 通过 `callTool(key, params)` 调 Tool，通过 `callLlm(promptKey, vars)` 调 LLM
- 领域计算类（如 ForecastEngine）放 Agent package 内，不注册为 Tool
- Tool 层只放跨 Agent 可复用的"外部感知"能力：取数据、导文件、调外部 API

---

## 6. API 接口规范

### 6.1 统一响应
- 系统管理接口：`R<T>`（`{ success, code, message, data }`）
- Agent 编排接口：`AgentResponse<T>`（`{ success, traceId, code, message, data }`）
- 有 traceId 语义的接口必须返回 traceId

### 6.2 错误码

格式：`{前缀}{序号}_{错误名}`

| 前缀 | 含义 |
|------|------|
| `A` | Agent / Orchestrator |
| `P` | Permission |
| `T` | Tool |
| `L` | LLM |
| `D` | Data |
| `C` | Contract / Schema |
| `S` | System |

示例：`A002_SKILL_NOT_FOUND`、`P001_PERMISSION_DENIED`、`T001_TOOL_NOT_FOUND`

### 6.3 REST 路径

- 全小写，如 `/api/agent/ask`、`/api/agent/catalog`
- 不使用驼峰或大写
- Agent 对话：`POST /api/agent/ask`
- Agent 目录：`GET /api/agent/catalog`
- RBAC CRUD：`GET/POST/PUT/DELETE /api/rbac/{resource}`

---

## 7. 权限规范（全局强制）

### 7.1 权限架构总览

```
┌─────────────────────────────────────────────┐
│  JWT 认证层 (JwtAuthenticationFilter)        │
│  所有请求 → 验证 JWT → 设置 SecurityContext  │
│  例外: publicPaths (login/captcha/swagger)   │
├─────────────────────────────────────────────┤
│  API 资源授权层 (ResourceAuthorizationFilter)│
│  每个 API = 1 条 sys_resource 记录           │
│  未登记路径策略: DENY（默认拒绝）             │
│  超级管理员: 跳过所有检查                     │
├─────────────────────────────────────────────┤
│  Agent 执行权限层 (AgentBase.execute)         │
│  Agent 声明 permissionLevel(1-5)             │
│  用户权限 LEVEL 不足 → 拒绝执行               │
│  角色-Agent 授权: sys_role_agent              │
├─────────────────────────────────────────────┤
│  前端 UI 权限层 (Permission 组件)             │
│  按钮/菜单/操作 → 检查 user.permissions[]    │
└─────────────────────────────────────────────┘
```

### 7.2 权限码命名规范

```
格式: {模块}:{资源}:{操作}
示例:
  system:user:view      查看用户
  system:user:add       新增用户
  system:user:edit      编辑用户
  system:user:delete    删除用户
  agent:ask             执行 Agent 对话
  agent:catalog:view    查看 Agent 目录
  system:role:grant     角色授权
  system:audit:view     查看审计日志
```

- 全小写，用 `:` 分隔
- 模块名在前，资源名居中，操作在后
- 操作动词: `view` / `add` / `edit` / `delete` / `grant` / `export` / `execute`

### 7.3 新增功能 RBAC 清单（每次新增功能必须逐项检查）

#### 新增菜单/页面

**步骤：**
1. `sys_menu` 插入菜单记录，分配 `permission_code`（如 `cashflow:forecast:view`）
2. `sys_role_menu` 授权给对应角色
3. 前端路由对应 `Permission` 组件包裹或菜单过滤

**示例：**
```sql
-- 1. 注册菜单
INSERT INTO sys_menu (id, parent_id, menu_name, path, component, permission_code, status)
VALUES ('menu-forecast', NULL, '预测看板', '/forecast', 'ForecastPage', 'cashflow:forecast:view', 1);

-- 2. 管理员授权
INSERT INTO sys_role_menu (id, role_id, menu_id)
VALUES ('rm-admin-forecast', 'role-admin', 'menu-forecast');
```

#### 新增按钮/操作

**前端：** 使用 `<Permission anyOf="...">` 包裹按钮
```tsx
<Permission anyOf="system:user:add" fallback={null}>
  <Button type="primary" onClick={handleAdd}>新增用户</Button>
</Permission>
```

**后端：** 无需额外 SQL 资源（按钮权限复用前端菜单 permission_code，或拆为独立菜单子项）

#### 新增 API 端点

**步骤（强制，不可跳过）：**
1. `sys_resource` 插入资源记录（method + path + resource_code + match_type）
2. `sys_role_resource` 授权给对应角色
3. 确认 `unregistered-resource-policy = DENY`（否则未登记路径默认放行）

**示例：**
```sql
-- 1. 注册 API 资源
INSERT INTO sys_resource (id, resource_name, resource_code, method, path, match_type, status)
VALUES ('res-forecast-export', '导出预测报表', 'cashflow:forecast:export',
        'GET', '/api/agent/cashflow/export', 'EXACT', 1);

-- 2. 管理员授权
INSERT INTO sys_role_resource (id, role_id, resource_id)
VALUES ('rr-admin-export', 'role-admin', 'res-forecast-export');

-- 3. 如果是 Agent 端点的 ANT 路径模式
INSERT INTO sys_resource (id, resource_name, resource_code, method, path, match_type, priority, status)
VALUES ('res-forecast-api', '预测 API', 'cashflow:forecast:api',
        'GET', '/api/agent/cashflow/**', 'ANT', 10, 1);
```

#### 新增 Agent 执行权限

**步骤：**
1. `AgentInfo.permissionLevel()` 声明所需级别（1-5）
2. `agent` 表插入记录（`agent_code` + `permission_level`）
3. `sys_role_agent` 授权给角色
4. `AgentBase.execute()` 自动校验（无需手动写权限代码）

**示例：**
```sql
-- 1. 注册 Agent
INSERT INTO agent (id, agent_code, agent_name, permission_level, status)
VALUES ('fx-exposure', 'fx-exposure', '外汇敞口分析', 2, 1);

-- 2. 授权
INSERT INTO sys_role_agent (id, role_id, agent_id)
VALUES ('ra-admin-fx', 'role-admin', 'fx-exposure');
```

```java
// 3. Agent 代码声明
@Override
public AgentInfo info() {
    return AgentInfo.builder()
        .id("fx-exposure")
        .permissionLevel(2)  // 自动校验: 用户 LEVEL >= 2 才可执行
        .build();
}
```

### 7.4 API 资源路径匹配规则

| 匹配类型 | 写法 | 适用场景 |
|----------|------|----------|
| `EXACT` | `/api/rbac/users` | 固定路径（POST 新增、GET 列表） |
| `ANT` | `/api/rbac/users/{id}` | 路径参数（PUT 编辑、DELETE 删除） |
| `ANT` | `/api/rbac/roles/{roleId}/**` | 路径参数 + 子路径（角色授权） |

**ANT 规则：**
- `{name}` 匹配单个路径段
- `**` 匹配零个或多个路径段
- `priority` 数值越大越优先（精确匹配用低 priority，模糊用高 priority）
- 同路径多方法时，PUT/DELETE 用 ANT，POST/GET 列表用 EXACT

### 7.5 路径分类与权限约束

| 路径分类 | 配置位置 | 说明 |
|----------|----------|------|
| **publicPaths** | `application.yml` | 无需登录: login, captcha, swagger, actuator |
| **authenticatedPaths** | `application.yml` | 登录即可，不检查资源权限: `/api/auth/me`, `/api/agent/**` |
| **资源权限路径** | `sys_resource` 表 | 必须登录 + 拥有对应 resource_code |

**规则：**
- publicPaths 只能放认证无关端点（登录、验证码、文档、健康检查）
- Agent 对话类端点放 authenticatedPaths（Agent 内部自己做权限校验）
- RBAC 管理类端点必须在 `sys_resource` 注册（路径级控制）
- **禁止** 将管理类 API 放入 publicPaths 或 authenticatedPaths

### 7.6 前端权限使用规范

**菜单级：** 后端 `menuTree(currentUserOnly=true)` 已过滤，前端直接渲染
```tsx
// 菜单已由后端按角色过滤，前端不需额外判断
<Menu items={menuItems} />
```

**页面级：** 路由组件中检查
```tsx
// App.tsx 路由配置中，菜单已过滤，路由层面由菜单可见性控制
```

**按钮/操作级：** 使用 Permission 组件
```tsx
import { Permission } from '../components/Permission';

// 单一权限
<Permission anyOf="system:user:add">
  <Button>新增用户</Button>
</Permission>

// 多权限（任一满足即可）
<Permission anyOf={['system:user:edit', 'system:user:delete']}>
  <Button>批量操作</Button>
</Permission>

// 无权限时不渲染
<Permission anyOf="system:role:grant" fallback={null}>
  <Button>授权</Button>
</Permission>
```

**数据级：** 查询时带 data_scope 过滤
```java
// 后端根据当前用户的 data_scope 过滤数据
String dataScope = rbacService.dataScopeByUser(userId);
// ALL → 查全部, DEPT_AND_SUB → 查本部门及下级, DEPT → 查本部门, SELF → 只查自己
```

### 7.7 权限码注册对照表（当前已注册）

| resource_code | method | path | 说明 |
|---------------|--------|------|------|
| `auth:me:view` | GET | `/api/auth/me` | 当前用户信息 |
| `system:menu:routes` | GET | `/api/rbac/menus/routes` | 用户路由 |
| `agent:ask` | POST | `/api/agent/ask` | Agent 对话（认证路径） |
| `agent:ask:stream` | POST | `/api/agent/ask/stream` | Agent 流式对话（SSE） |
| `agent:catalog:view` | GET | `/api/agent/catalog` | Agent 目录（认证路径） |
| `system:agent:view` | GET | `/api/agents` | 已授权 Agent 列表 |
| `system:agent:manage` | GET | `/api/agents/all` | Agent 管理（管理后台） |
| `system:agent:add` | POST | `/api/agents` | 新增 Agent |
| `system:agent:edit` | PUT | `/api/agents/{id}` | 编辑 Agent |
| `system:agent:delete` | DELETE | `/api/agents/{id}` | 删除 Agent |
| `system:user:view` | GET | `/api/rbac/users/**` | 查看用户 |
| `system:user:add` | POST | `/api/rbac/users` | 新增用户 |
| `system:user:edit` | PUT | `/api/rbac/users/{id}` | 编辑用户 |
| `system:user:delete` | DELETE | `/api/rbac/users/{id}` | 删除用户 |
| `system:role:view` | GET | `/api/rbac/roles/**` | 查看角色 |
| `system:role:add` | POST | `/api/rbac/roles` | 新增角色 |
| `system:role:edit` | PUT | `/api/rbac/roles/{id}` | 编辑角色 |
| `system:role:delete` | DELETE | `/api/rbac/roles/{id}` | 删除角色 |
| `system:role:grant` | POST | `/api/rbac/roles/{roleId}/**` | 角色授权 |
| `system:dept:view` | GET | `/api/rbac/departments/**` | 查看组织 |
| `system:dept:add` | POST | `/api/rbac/departments` | 新增组织 |
| `system:dept:edit` | PUT | `/api/rbac/departments/{id}` | 编辑组织 |
| `system:dept:delete` | DELETE | `/api/rbac/departments/{id}` | 删除组织 |
| `system:menu:view` | GET | `/api/rbac/menus/**` | 查看菜单 |
| `system:menu:add` | POST | `/api/rbac/menus` | 新增菜单 |
| `system:menu:edit` | PUT | `/api/rbac/menus/{id}` | 编辑菜单 |
| `system:menu:delete` | DELETE | `/api/rbac/menus/{id}` | 删除菜单 |
| `system:resource:view` | GET | `/api/rbac/resources/**` | 查看资源 |
| `system:resource:add` | POST | `/api/rbac/resources` | 新增资源 |
| `system:resource:edit` | PUT | `/api/rbac/resources/{id}` | 编辑资源 |
| `system:resource:delete` | DELETE | `/api/rbac/resources/{id}` | 删除资源 |
| `system:audit:view` | GET | `/api/rbac/audit/access` | 审计日志 |
| `system:model-provider:view` | GET | `/api/rbac/model-providers` | 查看模型供应商列表 |
| `system:model-provider:add` | POST | `/api/rbac/model-providers` | 新增模型供应商 |
| `system:model-provider:edit` | PUT | `/api/rbac/model-providers/{id}` | 编辑模型供应商 |
| `system:model-provider:delete` | DELETE | `/api/rbac/model-providers/{id}` | 删除模型供应商 |
| `connector:datasource:list` | GET | `/api/text2sql/connectors` | 数据源连接列表 |
| `connector:datasource:detail` | GET | `/api/text2sql/connectors/{id}` | 数据源连接详情 |
| `connector:datasource:add` | POST | `/api/text2sql/connectors` | 新增数据源连接 |
| `connector:datasource:edit` | PUT | `/api/text2sql/connectors/{id}` | 编辑数据源连接 |
| `connector:datasource:delete` | DELETE | `/api/text2sql/connectors/{id}` | 删除数据源连接 |
| `connector:datasource:test` | POST | `/api/text2sql/connectors/test` | 表单参数探测连接 |
| `connector:datasource:test-saved` | POST | `/api/text2sql/connectors/{id}/test` | 已存密文探测连接 |
| `connector:datasource:metadata` | GET | `/api/text2sql/connectors/{id}/metadata` | 拉取库表清单 |
| `connector:datasource:schema:refresh` | POST | `/api/text2sql/connectors/{id}/schema/refresh` | 刷新 Schema 缓存 |
| `connector:datasource:schema:view` | GET | `/api/text2sql/connectors/{id}/schema` | 查看 Schema 快照 |

### 7.8 权限安全底线（不可违反）

1. **新增 API 必须先注册资源再授权**，不允许未注册就直接放行
2. **未登记资源策略必须为 DENY**（`unregistered-resource-policy: DENY`）
3. **管理后台 API 禁止放入 publicPaths / authenticatedPaths**
4. **Agent 内部自己做二级权限校验**（AgentBase.execute 检查 permissionLevel）
5. **超级管理员检查必须在权限判断前执行**（hasSuperAdminRole → 跳过所有检查）
6. **前端权限检查是 UX 优化，不是安全边界** — 后端必须独立校验
7. **数据库操作必须带 data_scope 过滤**（SELF/DEPT/DEPT_AND_SUB/ALL）
8. **权限变更必须写审计日志**
9. **禁止在前端硬编码权限码判断 admin 角色**（权限码应从后端获取）
10. **新增角色时必须明确分配最小权限**，不允许默认给全部权限
11. **禁止将 `system:agent:manage` 等管理权限授予普通用户角色**

---

## 8. LLM 约束

1. 所有模型调用必须通过 `LlmGateway` 接口
2. 生产用 `DeepSeekLlmGateway`（`agent.llm.default-provider=deepseek`）
3. 测试用 `MockLlmGateway`（`agent.llm.default-provider=mock`）
4. LlmGateway 必须记录 traceId、token usage、耗时

**LLM 可以做：**
- 意图识别与补齐参数
- 生成叙事说明、摘要、解释
- 生成管理层简报
- 回答用户对结果的追问

**LLM 不可以：**
- 决定高风险业务是否执行
- 决定 Tool 调用链路
- 自动决定资金调拨/出款
- 修改财务口径
- 绕过多步骤确定性流程
- 直接输出不可追溯的最终结论
- LLM 叙事必须引用结构化数据，不允许凭空编造

Prompt 模板放 `resources/prompts/`，不在 Java 代码中硬编码长 Prompt。

---

## 9. 前端规范

### 9.1 目录结构

```
agent-web/src/
├── api/           # HTTP 接口统一封装，禁止组件中直接写 URL
├── app/           # App.tsx（路由）、AppLayout.tsx（布局）
├── components/    # 可复用组件，不绑定具体业务接口
├── pages/         # 页面编排，不写复杂业务逻辑
├── stores/        # Zustand 全局状态（token、user、agentId）
├── hooks/         # 可复用 Hook
├── types/         # TypeScript 类型定义
└── styles/        # 全局样式
```

### 9.2 状态管理
- 远端数据：TanStack React Query
- 本地 UI 状态：组件 `useState`
- 跨页面状态：Zustand
- 禁止把接口返回的大量列表复制到 Zustand 中

### 9.3 API 调用
- 所有 HTTP 请求通过 `src/api/` 封装
- Axios 拦截器统一处理 JWT、401、403
- Agent 编排接口透传 `traceId`

### 9.4 页面清单（一期 3 页）
- `/` — Agent 工作台（AgentWorkspacePage）
- `/forecast/:sessionId` — 预测看板（ForecastPage）
- `/settings` — 管理后台（SettingsPage）

### 9.5 B 端主题（Cursor Skill）

前端 UI/样式变更须遵循 Cursor Skill **`efloow-b-end-theme`**：

| 资源 | 路径 |
|------|------|
| Skill | `.cursor/skills/efloow-b-end-theme/SKILL.md` |
| 规则文档 | `frontend/docs/theme-skills.md` |
| 视觉 Demo | `frontend/docs/cssdemo.html` |
| Token 与语义类 | `frontend/src/index.css` |

约定：业务 TSX 使用 `ui-btn-primary`、`ui-card`、`ui-input` 等语义类；品牌色只定义在 `@theme`，不散落在组件中。

---

## 10. 命名规范

| 对象 | 规范 | 示例 |
|------|------|------|
| Java 类名 | `UpperCamelCase` | `CashflowAgent` |
| Java 方法/变量 | `lowerCamelCase` | `doExecute` |
| Java 常量 | `UPPER_SNAKE_CASE` | `DEFAULT_MODEL` |
| Java package | 全小写 | `com.efloow.agenthub.agent.cashflow` |
| TS 类型/组件 | `UpperCamelCase` | `AgentWorkspacePage` |
| TS 变量/函数 | `lowerCamelCase` | `askAgent` |
| React 组件文件 | `UpperCamelCase.tsx` | `TracePanel.tsx` |
| Hook 文件 | `useXxx.ts` | `useTraceStream.ts` |
| 数据库表/字段 | `lower_snake_case` | `execution_trace` |
| REST 路径 | 全小写 | `/api/agent/ask` |
| Agent id | `lowercase` | `cashflow` |

---

## 11. 日志规范（全链路可追溯）

### 11.1 日志体系架构

日志文件按模块分层输出到 `logs/` 目录：

| 文件 | 包路径 | 级别 | 内容 |
|------|--------|------|------|
| `logs/app.log` | `com.efloow.agenthub` (root) | INFO | 应用启动、配置、通用事件 |
| `logs/agent.log` | `base`, `controller`, `router`, `agent` | INFO | 路由决策、意图分类、Agent 执行 |
| `logs/tool.log` | `application.tool`, `infrastructure.tool` | INFO | Tool 调用、参数、结果、耗时 |
| `logs/llm.log` | `application.llm`, `infrastructure.llm` | DEBUG | LLM 请求/响应、token 用量、耗时 |
| `logs/audit.log` | `application.audit`, `system` | INFO | Trace 记录、访问审计、权限变更 |
| `logs/error.log` | 全包 | ERROR | 所有 ERROR 级别汇总 |

轮转策略：单文件 50MB，保留 30 个归档（gz 压缩），单类上限 500MB。

### 11.2 全链路日志节点

每个请求经过以下节点时必须记录日志：
- `TraceIdFilter`：注入 traceId + userId 到 MDC
- `AgentController`：记录请求入口（input, agentId, sessionId），注入 sessionId 到 MDC
- `AgentRouter`：记录路由决策（direct / llm / chat / no_match）
- `Gatekeeper`：记录门禁分类（CHAT / TASK）
- `AgentBase.execute()`：记录执行开始/完成/失败，注入 agentId 到 MDC
- `ToolExecutor`：记录 Tool 调用结果和耗时
- `LlmGateway`：记录 LLM 请求/响应摘要、token 用量和耗时
- `GlobalExceptionHandler`：记录异常堆栈
- `AuditAccessLogService`：记录访问审计

### 11.3 MDC 上下文规范

| MDC Key | 设置位置 | 清除时机 |
|---------|----------|----------|
| `traceId` | `TraceIdFilter` | `TraceIdFilter.finally` |
| `userId` | `TraceIdFilter`（从 SecurityContext 读取） | `TraceIdFilter.finally` |
| `sessionId` | `AgentController` | 请求结束 |
| `agentId` | `AgentBase.execute()` | `AgentBase.execute() finally` |

AgentBase.execute() 不再自行生成 traceId，统一从 MDC 获取（非 HTTP 场景自动 fallback）。

### 11.4 日志级别使用

1. `ERROR`：需立即处理——LLM 调用失败、数据库异常、外部系统不可用（必须包含异常堆栈）
2. `WARN`：可恢复异常——权限不足、Tool 未找到、参数校验失败、LLM fallback 降级
3. `INFO`：关键业务节点——路由决策、Agent 执行开始/结束、Tool 调用、LLM 请求/响应、审计记录
4. `DEBUG`：调试信息——LLM 请求详情、Gatekeeper 分类、Agent 匹配过程（生产环境关闭）

### 11.5 日志安全底线

禁止在日志中输出：
1. API Key / Secret
2. 用户密码 / BCrypt hash
3. 完整银行账号 / 身份证号
4. 完整手机号 / 邮箱
5. 完整 Prompt 原文（生产环境）
6. JWT Token 原文

### 11.6 关键类 Logger 清单

每个关键类必须声明 Logger：
- `AgentController`、`AgentRouter`、`Gatekeeper` → agent.log
- `AgentBase`（子类 getClass()） → agent.log
- `ToolExecutor` → tool.log
- `DeepSeekLlmGateway`、`MockLlmGateway` → llm.log
- `TraceService`、`AuditAccessLogService` → audit.log
- `GlobalExceptionHandler` → error.log

### 11.7 开发/生产环境

```yaml
# 开发
logging.level.com.efloow.agenthub: DEBUG

# 生产
logging.level.com.efloow.agenthub: INFO
logging.level.com.efloow.agenthub.infrastructure.llm: INFO
```

---

## 12. 一期范围

### 一期做
- [x] CashflowAgent（现金流预测）
- [x] Agent 工作台 + 对话式交互
- [x] 预测看板（ECharts 趋势图 + 明细表 + 简报）
- [x] Excel 报表导出
- [x] RBAC 管理后台 + L1 Agent 管理
- [x] TMS 数据连接（demo 数据）
- [x] SSE 流式输出

### 一期不做
- 多 Agent 自主协同
- L2 查询型 Agent 配置（二期）
- L3 流程型编排（永不）
- Trace 回放界面
- Electron 桌面端

---

## 13. 编码格式

1. 所有源文件 UTF-8
2. Java 缩进 4 空格，单行不超过 120 字符
3. TypeScript 缩进 2 空格，单行不超过 100 字符
4. 禁止使用 Tab
5. 禁止提交 IDE 私有配置

### 注释规范
- 注释说明"为什么"，不重复"代码做了什么"
- 复杂业务规则必须注释说明业务口径来源
- 禁止无 Issue 编号的 TODO
- 禁止"临时处理""以后再说""先这样"等不可追踪注释

---

## 14. Redis 规范

1. Redis 只存缓存和运行态，不作为主数据源
2. Key 必须有命名空间，必须设置 TTL
3. 禁止永久保存业务主数据
4. 会话上下文可存 Redis，最终消息记录必须落 PostgreSQL
5. 分布式锁必须设置过期时间
6. 限流 key 按用户/Agent/模型维度区分
7. Redis 不可用时，核心读写链路有明确降级策略

推荐 key 格式：
```
agent:session:{sessionId}
agent:trace:{traceId}
agent:lock:{businessKey}
```

---

## 15. Trace / Audit 规范

### Trace（每次 Agent 执行必须记录）
- traceId、userId、sessionId、agentId
- intent_action（如 forecast / explain）
- inputText 摘要
- started_at / completed_at
- error_message
- outputs / clientActions

### Audit（必须审计的事件）
- 登录/登出、Agent 调用、Tool 调用、LLM 调用摘要
- 报表导出、权限变更、高风险操作确认

### 禁止
- 审计日志 UPDATE / DELETE
- 审计日志保存明文密钥/未脱敏敏感账号
- 记录完整 Prompt 原文（生产环境）

---

## 16. Git / PR / CI 规范

### Commit
格式：`<type>(<scope>): <subject>`

type: `feat | fix | refactor | test | docs | chore | perf | style | ci | build`

scope: `agent | router | cashflow | tool | llm | frontend | auth | rbac | data | trace`

示例：
```
feat(cashflow): add 13-week rolling forecast engine
fix(tool): handle empty ledger data in LedgerFetchTool
refactor(router): replace hardcoded intent matching with LLM routing
```

### CI（至少执行）
- 前端 `npm run typecheck && npm run build`
- 后端 `mvn compile && mvn test`

---

## 17. 测试规范

### 后端必须覆盖
1. Agent.classify() 意图分类命中
2. Agent.doExecute() 正常执行
3. ToolHandler 正常、空数据、非法参数
4. LlmGateway 超时、重试、fallback
5. TraceService 记录完整性
6. 权限拦截

### 前端建议覆盖
1. Agent 工作台渲染
2. API 错误处理
3. 预测看板图表渲染

---

## 18. 项目完成定义

一个功能同时满足以下条件才视为完成：
1. 代码已实现 + 前端/后端接口已完成
2. 权限已接入
3. Trace 已记录
4. 错误码已定义
5. 涉及 Tool 的 inputSchema 已定义
6. 涉及 LLM 的 Prompt 已外部化到 `resources/prompts/`
7. 涉及数据库的 Migration 已提交 + COMMENT ON 已补
8. 单元测试已通过

---

## 19. 绝对禁止事项

- 重新引入 Skill YAML / SkillRegistry / SkillExecutor / RuleEngine / IntentClassifier 硬编码
- 数据库使用 `timestamptz` / `now()`
- Java 使用 `OffsetDateTime` / `ZonedDateTime` / `ZoneOffset`
- 引入 LangChain / LangGraph / LlamaIndex / Semantic Kernel
- Controller 中写业务逻辑
- Tool 中调用 LLM
- `@Transactional` 内调外部 HTTP
- 硬编码密钥 / 密码 / 域名 / API Key
- 审计日志表 UPDATE / DELETE
- `SELECT *`
- 创建表/字段不加注释（PostgreSQL 用 `COMMENT ON TABLE/COLUMN ... IS '...'`，非 MySQL 内联语法）
- 创建表缺少公共字段（id, status, remark, create_by, create_time, update_by, update_time）

---

## 20. 数据字典规范（外部数据源）

### 20.1 为什么需要

接入的外部数据库（如 TMS 资金管理系统）结构不在本项目的 SQL 迁移中，缺乏 COMMENT ON 和管理。需要一层人工维护的业务文档来描述"表做什么、表间怎么关联、字段含义"。

### 20.2 三层知识体系

| 层 | 载体 | 维护方式 | 用途 |
|----|------|----------|------|
| **A — 业务字典** | `docs/dictionary/*.md` | 人工编写，版本受控 | 理解业务含义 |
| **B — Schema 快照** | `data_source_schema_cache` (DB) | API 自动采集 | 技术元数据，供 LLM 检索 |
| **C — 语义术语** | `text2sql_semantic_term` (DB) | 前端 CRUD | 业务口语→表.列映射 |

### 20.3 字典文档规范

- 每接入一个外部数据源 → 编写一册 `docs/dictionary/{db-name}.md`
- 使用 `_template.md` 模板，必含 6 节：概要、核心表清单、表关系图、逐表详解、常见查询路径、已知陷阱
- 表结构变更 → 同步更新字典 + 刷新 Schema 快照
- 字典随代码 PR 提交，版本受控
