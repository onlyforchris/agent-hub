# Agent Hub — Agent 中台

企业级 Agent 编排中台，提供 Agent 运行时、LLM 网关、Tool 注册、RBAC 权限体系、Text2SQL 自然语言查数、Workflow 编排等核心能力。一期已交付现金流预测 Agent（CashflowAgent），支持对话式交互、SSE 流式输出、报表导出与可视化看板。

---

## 技术栈

| 层 | 技术 |
|---|------|
| 后端框架 | Java 17 / Spring Boot 3.3.5 / Maven 多模块 |
| 数据库 | PostgreSQL 16（pgvector + TimescaleDB） |
| 缓存 | Redis 7 |
| ORM | MyBatis-Plus 3.5.7 |
| 认证授权 | Spring Security 6 + 自研 JWT (HS256) + RBAC |
| API 文档 | springdoc-openapi 2.6 + Knife4j 4.5 |
| Excel | EasyExcel 4.0.3 |
| 前端框架 | React 19 / TypeScript 5 / Vite 6 |
| UI | Tailwind CSS 4 / Ant Design 5 / Lucide React |
| 图表 | Recharts |
| 状态管理 | Zustand / TanStack React Query |

> 详细技术栈约束与禁止引入项见 [CLAUDE.md](./CLAUDE.md) 第 1 节。

---

## 项目结构

```
agent-hub/
├── backend/                         # 后端 Maven 多模块
│   ├── agent-server-app/            #   启动模块（启动类 + application.yml）
│   ├── agent-server-common/         #   公共模块（R, AgentResponse, 异常, 过滤器）
│   ├── agent-server-system/         #   系统模块（RBAC: 用户/角色/菜单/资源）
│   └── agent-server-runtime/        #   Agent 运行时（AgentBase, Router, Agent 实现, LLM, Tool）
├── frontend/                        # 前端 React + Vite
│   └── src/
│       ├── api/                     #   HTTP 接口封装
│       ├── components/              #   可复用组件 + 页面视图
│       ├── lib/                     #   工具函数、Workflow 引擎
│       └── types/                   #   TypeScript 类型定义
├── database/init/                   # 数据库迁移 SQL（按序号执行）
├── docker/                          # Dockerfile（PostgreSQL 定制镜像）
├── scripts/                         # docker-compose.yml + 辅助脚本
└── docs/                            # 技术方案与设计文档
```

---

## 快速开始

### 前置条件

- **JDK 17+**
- **Maven 3.8+**
- **Node.js 18+**（推荐 22+）
- **Docker + Docker Compose**（用于启动 PostgreSQL 和 Redis）

### 1. 启动基础设施（PostgreSQL + Redis）

```bash
# 构建 PostgreSQL 定制镜像（pgvector + TimescaleDB）
docker build -f docker/Dockerfile.postgres -t efloow-postgres:16 .

# 启动所有服务
docker compose -f scripts/docker-compose.yml up -d
```

PostgreSQL 连接：`127.0.0.1:5431` / `efloow_agent` / `postgres`  
Redis 连接：`127.0.0.1:6378`

### 2. 启动后端

```bash
cd backend
mvn clean compile -DskipTests

# 启动 Spring Boot（主类: AgentHubApplication）
cd agent-server-app
mvn spring-boot:run
```

后端启动后访问：
- API 文档（Knife4j）：`http://localhost:8080/doc.html`
- Swagger JSON：`http://localhost:8080/v3/api-docs`

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器：`http://localhost:9001`（API 请求自动代理到后端）

---

## 核心特性

### Agent 运行时

- **AgentBase 骨架**：`execute()` 为 final 方法，自动完成权限校验 → 执行 → Trace 记录 → 异常兜底
- **LLM 路由**：AgentRouter 支持精确匹配与 LLM 语义路由
- **意图分类 + 多动作分发**：每个 Agent 自行实现 `classify()` 与 `doExecute()`
- **SSE 流式输出**：`POST /api/agent/ask/stream`，实时推送 Agent 执行过程
- **全链路 Trace**：每次 Agent 执行记录 traceId、步骤、耗时、输入输出

### RBAC 权限体系

- 四层权限：JWT 认证 → API 资源授权 → Agent 执行权限级 → 前端 UI 权限
- 权限码格式：`{模块}:{资源}:{操作}`（如 `system:user:add`）
- 未登记 API 默认拒绝（`DENY` 策略）
- 支持数据级权限过滤（SELF / DEPT / DEPT_AND_SUB / ALL）

### Text2SQL 自然语言查数

- Schema 自动采集与缓存
- 语义术语映射（业务口语 → 表.列）
- LLM SQL 生成 + 端到端执行

### Workflow 编排

- DAG 可视化编排（基于 @xyflow/react）
- 支持节点拖拽、连线、参数配置
- Workflow JSON 持久化存储

### 更多特性

- Tool 注册中心：可复用、无状态的外部感知能力
- 模型供应商管理：支持 DeepSeek 等多 Provider
- 审计日志：登录、Agent 调用、Tool 调用、权限变更全记录
- 通知与待办系统

---

## API 概览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/agent/ask` | POST | Agent 对话 |
| `/api/agent/ask/stream` | POST | Agent 流式对话（SSE） |
| `/api/agent/catalog` | GET | Agent 目录 |
| `/api/agents` | GET/POST | Agent 管理 |
| `/api/rbac/users/**` | CRUD | 用户管理 |
| `/api/rbac/roles/**` | CRUD | 角色管理与授权 |
| `/api/rbac/menus/**` | CRUD | 菜单管理 |
| `/api/rbac/resources/**` | CRUD | API 资源管理 |
| `/api/text2sql/connectors/**` | CRUD | 数据源连接管理 |
| `/api/tools` | GET | Tool 注册中心 |

> 完整 API 列表与权限码对照见 [CLAUDE.md](./CLAUDE.md) 第 6-7 节。

---

## 开发规范

项目有严格的开发规范，涵盖架构分层、数据库设计、时间字段、权限接入、日志体系、命名规范、Git Commit 格式等，详见 **[CLAUDE.md](./CLAUDE.md)**（全项目规则文档）。

关键约束速览：
- Agent 流程以 Java 代码直写（`AgentBase.doExecute()`），不使用 YAML DSL 或可视化编排
- 数据库时间字段统一 `timestamp(6)` + `LOCALTIMESTAMP(6)`，Java 端统一 `LocalDateTime`
- 所有表必须包含公共字段（id, status, remark, create_by, create_time, update_by, update_time）
- `@Transactional` 内禁止调用 LLM 或外部 HTTP
- 禁止引入 LangChain / LangGraph / LlamaIndex / Semantic Kernel 等框架

---

## 设计文档

| 文档 | 说明 |
|------|------|
| [Agent中台产品方案-v1.0](./docs/Agent中台产品方案-v1.0.md) | 产品方案与需求 |
| [Agent中台技术选型与技术方案-v2.0](./docs/Agent中台技术选型与技术方案-v2.0.md) | 技术选型与架构设计 |
| [RBAC 技术方案](./docs/RBAC%20技术方案.md) | 权限体系设计 |
| [Skill平台技术落地方案](./docs/Skill平台技术落地方案.md) | Skill 平台落地 |
| [Text2SQL自然语言查数技术方案](./docs/Text2SQL自然语言查数技术方案.md) | Text2SQL 总体方案 |
| [Text2SQL-RAG与语义检索技术方案-Phase2](./docs/Text2SQL-RAG与语义检索技术方案-Phase2.md) | RAG 与语义检索 |
| [Text2SQL-SQL生成与端到端执行方案-Phase3](./docs/Text2SQL-SQL生成与端到端执行方案-Phase3.md) | SQL 生成与执行 |
| [会话与链路上下文设计](./docs/会话与链路上下文设计.md) | 会话与 Trace 链路 |
| [日志体系设计文档](./docs/日志体系设计文档.md) | 日志分层与全链路追踪 |
| [待办与通知系统设计](./docs/待办与通知系统设计.md) | 通知与待办 |
| [规则与接入与系统连接器设计](./docs/规则与接入与系统连接器设计.md) | 连接器设计 |
| [技术评审-全部问题与决策](./docs/技术评审-全部问题与决策.md) | 技术评审记录 |

---

## License

MIT
