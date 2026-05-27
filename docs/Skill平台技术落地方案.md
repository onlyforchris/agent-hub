# Skill 平台技术落地方案

> 版本：v1.1  
> 日期：2026-05-26  
> 适用范围：Agent 中台 Skill 注册、路由、执行策略、强确认、脚本/CLI 执行与 CRUD 管理  
> 变更（v1.1）：新增 §8 Skill 脚本资源与 CLI 子进程沙箱；Document Skills（docx/pdf/pptx/xlsx）补齐与 Tool 映射

---

## 1. 概述

### 1.1 目标

建设一套 **Skill 平台**，使团队能够：

1. 以 **Agent Skills 开放标准**（目录 + `SKILL.md`）创建、导入、导出 Skill
2. 在管理后台对 Skill 进行 **增删改查、发布、版本管理**
3. 运行时按 **渐进披露（Progressive Disclosure）** 加载 Skill，控制上下文成本
4. 在 Skill 数量增长（30 → 50 → 100+）时，通过 **分层路由 + 向量检索** 稳定选型
5. 将 **执行形态（网络/写盘/脚本/工具）** 交给管理员或 Skill 作者配置；**默认允许网络与写操作，但必须强确认**

### 1.2 非目标

- 不把 Skill 做成 **可视化流程编排引擎**（无 `steps[]` DSL + 自动逐步执行器）
- 不让 LLM 单独决定高风险副作用是否执行（须过 **PolicyGate + ConfirmGate**）
- 不强制 Runtime 依赖本机固定目录；目录仅作为 **导入/导出/Git 评审** 视图

### 1.3 与业界实践对齐

| 能力 | 业界做法 | 本方案 |
|------|----------|--------|
| 包格式 | `{skill-name}/SKILL.md` + YAML frontmatter | 兼容，DB 为发布真相 |
| 发现 | 递归扫描 `.cursor/skills/` 等 | 文件扫描 + DB Registry |
| 加载 | 先 name+description，命中后读正文 | Progressive Disclosure |
| 路由 | paths 切片 / 显式 `/skill` / 语义 Top-K | 四层路由（见 §5） |
| 副作用 | `disable-model-invocation`、`allowed-tools` | 扩展为 `execution_policy` |
| 脚本/CLI | Skill 包内 `scripts/` + Bash 示例 | **具名 Tool → CliProcessRunner**（禁止 LLM 自由 shell） |
| 大规模 | embedding 索引 name+description | pgvector，100+ 启用 |

---

## 2. Skill 包格式

### 2.1 目录结构

```text
{skill-code}/
├── SKILL.md              # 必需：frontmatter + 指令正文
├── references/           # 可选：扩展文档
│   └── api-guide.md
├── scripts/              # 可选：可执行脚本（沙箱）
│   └── validate.sh
└── assets/               # 可选：模板、示例
    └── report-template.xlsx
```

### 2.2 SKILL.md 结构

```markdown
---
name: deploy-staging
description: 将应用部署到预发环境。在用户要求 deploy staging 或发布预发时使用。
metadata:
  author: platform-team
  version: "1.2.0"
  category: shipping
  execution_policy:
    network:
      mode: allow_with_confirm
      allowlist: ["api.example.com"]
    filesystem_write:
      mode: allow_with_confirm
      paths: ["dist/**", "build/**"]
    scripts:
      mode: allow_with_confirm
      sandbox: strict
    tools:
      mode: allowlist
      allowlist: ["shell.exec", "http.post"]
    side_effect_level: high
    auto_invoke: false
    context: fork
paths:
  - "apps/web/**"
  - "deploy/**"
allowed-tools: Read Write Bash
---

# Deploy to Staging

## When to use
...

## Steps
1. Run tests: `npm test`
2. Build: `npm run build`
3. Run [scripts/deploy.sh](./scripts/deploy.sh) with env=staging
```

### 2.3 Frontmatter 字段映射

| 标准字段 | 用途 | DB 列 / JSON 路径 |
|----------|------|-------------------|
| `name` | 唯一标识，与目录名一致 | `skill_code` |
| `description` | 路由与目录展示 | `description` |
| `paths` | 文件 glob 切片 | `paths_json` |
| `allowed-tools` | Tool 白名单（实验） | `policy_json.tools` |
| `disable-model-invocation` | 禁止自动触发 | `auto_invoke = false` |
| `context: fork` | 子 Agent 隔离执行 | `context_mode = fork` |
| `metadata.execution_policy` | 执行策略 | `policy_json` |
| `metadata.version` | 版本 | `version` |

正文 Markdown 存入 `content_md`；附属文件存对象存储或 `sys_skill_resource` 表。

---

## 3. 运行时架构

```text
                    ┌──────────────────┐
  Git / 上传导入 ──►│ Skill Parser     │──► 校验 + 规范化
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
  管理台 CRUD ─────►│ sys_skill (DB)   │◄── 发布 / 版本
                    └────────┬─────────┘
                             │ publish
                             ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ AgentRouter │────►│ SkillRouter      │────►│ SkillLoader     │
│ (选 Agent)  │     │ (选 Skill)       │     │ (渐进加载 body) │
└─────────────┘     └────────┬─────────┘     └────────┬────────┘
                             │                        │
                             ▼                        ▼
                    ┌────────────────────────────────────────┐
                    │ SkillSession (merged execution_policy) │
                    └────────────────────┬───────────────────┘
                                         ▼
                    ┌────────────────────────────────────────┐
                    │ PolicyGate → ConfirmGate → Executor    │
                    │ (网络/写盘/脚本/Tool)                   │
                    └────────────────────┬───────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
     │ ToolExecutor    │       │ GroovySandbox   │       │ CliProcessRunner│
     │ (具名 Tool)     │       │ (JVM 内脚本)    │       │ (子进程/CLI)    │
     └─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 3.1 核心模块

| 模块 | 职责 |
|------|------|
| **SkillDiscovery** | 启动/发布时加载 DB；可选监听 Git 目录做 dev 同步 |
| **SkillParser** | 解析 YAML frontmatter + Markdown；校验 schema |
| **SkillRegistry** | 内存索引：code → 元数据；懒加载 content |
| **SkillRouter** | 见 §5 |
| **SkillLoader** | Level-1 元数据；Level-2 正文；Level-3 references/scripts 元数据 |
| **SkillResourceMaterializer** | 发布时将 `sys_skill_resource` 同步到会话工作区（见 §8.3） |
| **PolicyGate** | 合并 L0～L3 策略，判定动作是否允许/需确认 |
| **ConfirmGate** | 复用 Agent `ConfirmRequest` / `POST /api/agent/confirm` |
| **SkillExecutor** | 注入 prompt 或 fork 子 Agent；**不直接 exec**；调度 ToolExecutor |
| **GroovySandbox** | 现有 `ScriptSandboxService`：JVM 内 Groovy，用于规则/计算 |
| **CliProcessRunner** | 新增：白名单 CLI / Python 子进程，用于 Skill 包脚本（见 §8） |

---

## 4. 执行策略与强确认

### 4.1 设计原则

- **执行形态可配置**：网络、写文件、脚本、Tool 由管理员/作者在 Skill 或租户级配置
- **默认偏开放、偏安全**：默认 `allow_with_confirm`（允许，但须强确认）
- **策略合并取最严**：`deny` > `allow_with_confirm` > `allow`

### 4.2 策略层级

| 层级 | 来源 | 说明 |
|------|------|------|
| L0 | 平台默认 `application.yml` | 全局 baseline |
| L1 | `sys_tenant_skill_policy` | 租户上限（如生产禁止 `network: allow`） |
| L2 | `sys_skill.policy_json` | Skill 作者配置 |
| L3 | `agent_skill.policy_override` | Agent 挂载时收紧 |
| L4 | 单次 Run（管理员） | 临时授权，须审计 |

### 4.3 强确认触发条件

在 `mode = allow_with_confirm` 时，以下动作执行前必须弹出确认：

| 动作类型 | `actionType` | 示例 |
|----------|--------------|------|
| 出站网络 | `network` | HTTP POST webhook |
| 写文件 | `filesystem_write` | 修改源码、写配置 |
| 执行脚本 | `script` | `scripts/deploy.sh` |
| 高危 Tool | `tool` | 部署、发消息、写 DB |
| 高 side_effect | — | `side_effect_level >= high` |

只读操作（Read/Grep/只读 SQL、embedding 检索）不触发确认。

### 4.4 与现有 Agent 确认机制集成

- SSE 事件：`confirm_request`（已有 `AgentStreamEvent.confirmRequest`）
- HTTP 确认：`POST /api/agent/confirm`（已有 `sessionId + confirmId + approved`）
- Skill 侧扩展：`detail` 中增加 `skillCode`、`actionType`、`policySource` 等字段
- 审计：写入 `sys_skill_confirm_audit`（见附录 B）

### 4.5 平台默认策略

```json
{
  "network": { "mode": "allow_with_confirm", "allowlist": [] },
  "filesystem_write": { "mode": "allow_with_confirm", "paths": ["**"] },
  "scripts": { "mode": "allow_with_confirm", "sandbox": "strict" },
  "tools": { "mode": "inherit", "allowlist": [], "denylist": [] },
  "side_effect_level": "medium",
  "auto_invoke": true,
  "context": "inline"
}
```

---

## 5. Skill 路由

### 5.1 四层路由（按优先级）

```text
1. 显式调用     /skill-name、请求参数 skillCode、UI 按钮
2. 确定性触发   paths glob 命中当前工作区文件集
3. 候选检索     embedding Top-K（name + description + tags）
4. LLM 精选     仅在 Top-K≤20 时，要求模型返回 skill_code
```

未命中时：不加载 Skill 正文，Agent 按基座 prompt 继续。

### 5.2 分阶段启用

| 阶段 | Skill 规模 | 路由策略 |
|------|------------|----------|
| P1 | ≤30 | 显式 + paths + 关键词/tags；可选 LLM 短列表 |
| P2 | 30～50 | 增加 Agent 分桶（`agent_skill` 挂载表过滤） |
| P3 | 50～100 | pgvector Top-K + 可选 rerank |
| P4 | 100+ | 两阶段检索（bi-encoder + cross-encoder 重排） |

### 5.3 渐进披露

| Level | 加载内容 | 时机 |
|-------|----------|------|
| L0 | 全量 skill 的 code + name + description（或索引） | 会话/Agent 初始化 |
| L1 | 选中 skill 的完整 `SKILL.md` body | Router 命中后 |
| L2 | references / scripts 元数据 | body 内引用时 |
| L3 | 脚本执行 / 文件读取 | Executor 经 **具名 Tool** 调用 `CliProcessRunner`（§8） |

---

## 6. 数据模型与 CRUD

### 6.1 核心表

| 表 | 用途 |
|----|------|
| `sys_skill` | Skill 主表（发布态元数据 + policy + content） |
| `sys_skill_version` | 版本历史（draft / published） |
| `sys_skill_resource` | 附属文件（references/scripts/assets） |
| `agent_skill` | Agent 挂载与策略 override |
| `sys_tenant_skill_policy` | 租户级策略上限 |
| `sys_skill_confirm_audit` | 强确认审计（不可变） |
| `sys_skill_embedding` | 路由向量（可选，100+ 启用） |

详细 DDL 见 **附录 B**。

### 6.2 API 清单

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/skills` | 列表（仅元数据） |
| GET | `/api/skills/{id}` | 详情 |
| POST | `/api/skills` | 创建草稿 |
| PUT | `/api/skills/{id}` | 更新 |
| DELETE | `/api/skills/{id}` | 逻辑删除 |
| POST | `/api/skills/{id}/publish` | 发布并刷新 Registry |
| POST | `/api/skills/import` | 上传 **SKILL.md 或目录 zip**（含 `scripts/`、`references/`） |
| GET | `/api/skills/{id}/export` | 导出为标准目录包 |
| POST | `/api/skills/test-route` | 路由仿真（输入 + 返回 Top-K） |

OpenAPI 片段见 **附录 C**。

### 6.3 RBAC 权限码（建议）

| resource_code | 说明 |
|---------------|------|
| `system:skill:view` | 查看 Skill 列表/详情 |
| `system:skill:add` | 新增 |
| `system:skill:edit` | 编辑 |
| `system:skill:delete` | 删除 |
| `system:skill:publish` | 发布 |
| `system:skill:import` | 导入 |
| `system:skill:export` | 导出 |

须在 `sys_resource` 注册并授权；遵循项目 DENY 默认策略。

---

## 7. 安全与审计

1. **一次确认绑定一次动作**：`confirmId` 与 `action_fingerprint`（URL+路径+脚本 hash）绑定，不可复用于其他动作
2. **双沙箱隔离**：Groovy（JVM 内）与 CLI（子进程）分离；Groovy 沙箱**禁止** `ProcessBuilder` / `Runtime.exec`；CLI 仅通过 `CliProcessRunner` + 具名 Tool 触发（见 §8.2）
3. **CLI strict 模式**：`sandbox: strict` 时禁止 shell 字符串拼接、禁止网络、工作目录 jail、命令 argv 白名单、超时与 stdout 上限
4. **租户策略上限**：Skill 级不能比 L1 更松（例如租户禁止 `network: allow` 则 Skill 不能设为 allow）
5. **审计不可变**：`sys_skill_confirm_audit` 仅 INSERT
6. **日志脱敏**：确认载荷中不记录密钥、完整账号、JWT

---

## 8. Skill 脚本资源与 CLI 执行

> 适用场景：Document Skills（docx / pdf / pptx / xlsx）及一切在 `SKILL.md` 正文中引用 `scripts/`、Python、系统 CLI 的 Skill 包。  
> 参考来源：[anthropics/skills](https://github.com/anthropics/skills)（完整包含 `SKILL.md` + `scripts/` + `LICENSE.txt`）。

### 8.1 现状与差距

| 能力 | Skill 正文假设 | 当前平台（v1.0～P2） | 目标（§8） |
|------|----------------|---------------------|------------|
| 指令注入 | 读 `SKILL.md` 指导 LLM | ✅ `SkillLoader` L1 | 保持 |
| Python 脚本 | `python scripts/office/unpack.py ...` | ❌ 无执行器 | `CliProcessRunner` |
| 系统 CLI | `pandoc` / `pdftoppm` / `qpdf` | ❌ 未封装 | 具名 Tool + argv 白名单 |
| Groovy 沙箱 | — | ✅ `sandbox.script.eval` | 仅规则/计算，**不**跑 Office 脚本 |
| Skill 附属文件 | `scripts/`、`references/` | 表已建，导入/物化未完整 | zip 导入 + 发布物化 |

**原则：** LLM **不得**自由拼接 bash 并在服务端执行；Skill 正文中的 shell 示例应映射为 ReAct `ACTION: {toolKey} | {json}`，由 **ToolExecutor → PolicyGate → CliProcessRunner** 执行。

### 8.2 双沙箱模型

```text
┌─────────────────────────────────────────────────────────────────┐
│ ScriptSandboxService (Groovy, 同 JVM)                              │
│ 用途：Tool Registry 内嵌 Groovy、数据过滤/规则/轻量计算           │
│ 禁止：ProcessBuilder、Runtime.exec、java.io/java.nio 等           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CliProcessRunner (子进程, 新增)                                  │
│ 用途：Skill 包 Python、 pandoc、 LibreOffice 包装命令             │
│ 入口：仅具名 ToolHandler（如 document.office.unpack）             │
│ 禁止：/bin/sh -c 字符串、任意用户输入拼进 argv                     │
└─────────────────────────────────────────────────────────────────┘
```

`sys_tool_registry.runtime_kind` 扩展建议：

| runtime_kind | 执行引擎 | 典型 Tool |
|--------------|----------|-----------|
| `GROOVY` | `ScriptSandboxService` | `sandbox.script.eval`、注册表脚本 Tool |
| `JAVA_BEAN` | Spring `ToolHandler` | `ledger.fetch`、`weather.lookup` |
| `CLI` | `CliProcessRunner` | `document.office.unpack`、`document.pandoc.convert` |
| `PYTHON_FILE` | `CliProcessRunner` + skill 工作区内 `.py` | 包内 `scripts/office/pack.py` |

### 8.3 三层执行架构

```text
  LLM 读 Skill 正文（L1）
       │
       ▼
  ACTION: document.office.unpack | {"inputPath":"a.docx","outputDir":"unpacked/"}
       │
       ▼
  ToolExecutor ──► SkillPolicyGate (SCRIPT / FILESYSTEM_WRITE / TOOL)
       │                    │
       │                    ├── deny → 拒绝
       │                    ├── allow_with_confirm → ConfirmGate (SSE + /api/agent/confirm)
       │                    └── allow → 继续
       ▼
  CliProcessRunner
       │  ProcessBuilder(List<String> argv)   # 禁止 shell -c
       │  workingDir = 会话工作区
       │  timeout / maxStdout / env 白名单
       ▼
  { exitCode, stdout, stderr, durationMs } → ToolResult → Trace
```

**会话工作区路径（建议）：**

```text
{agent.skill.work-root}/{sessionId}/{skillCode}/
  SKILL.md                    # 可选镜像
  scripts/office/unpack.py    # 来自 sys_skill_resource
  workspace/                  # 用户上传/Agent 生成的 docx/pdf 等
    input/
    output/
    unpacked/
```

Redis 仅存 session 指针；文件落盘路径须在 `filesystem_write.paths` 策略范围内。

### 8.4 Skill 资源包补齐

#### 8.4.1 标准目录（与 Anthropic 对齐）

```text
{skill-code}/
├── SKILL.md
├── LICENSE.txt               # 建议一并导入
├── scripts/
│   ├── office/
│   │   ├── unpack.py
│   │   ├── pack.py
│   │   ├── validate.py
│   │   └── soffice.py
│   ├── comment.py            # docx 专用
│   └── recalc.py             # xlsx 专用
└── references/               # 可选
    └── editing.md
```

#### 8.4.2 入库与物化

| 步骤 | 动作 |
|------|------|
| 导入 | `POST /api/skills/import` 支持 **zip 目录包**（含 `SKILL.md` + `scripts/**`） |
| 存储 | 小文件 → `sys_skill_resource.content_text`；大文件 → `storage_uri` |
| 发布 | `SkillResourceMaterializer` 写入 `{work-root}/{skillCode}/` 并刷新 hash 索引 |
| 校验 | 附录 D：正文引用的 `scripts/...` 路径必须在 resource 表中存在 |

#### 8.4.3 Document Skills 内置种子（平台默认）

| skill_code | 来源 | category | paths 触发 | 说明 |
|------------|------|----------|------------|------|
| `docx` | anthropics/skills/skills/docx | document | `**/*.docx` | Word 创建/编辑/修订 |
| `pdf` | anthropics/skills/skills/pdf | document | `**/*.pdf` | PDF 读写/合并/OCR |
| `pptx` | anthropics/skills/skills/pptx | document | `**/*.pptx` | 演示文稿 |
| `xlsx` | anthropics/skills/skills/xlsx | document | `**/*.xlsx`, `**/*.csv` | 表格与财务模型规范 |

转化脚本（仓库内）：`scripts/convert-document-skills.mjs` — 为 frontmatter 补全 `execution_policy`、`paths`、`tags`。  
**注意：** 仅含 `*_SKILL.md` 的 zip **不够**；必须从 [anthropics/skills](https://github.com/anthropics/skills) vendoring 完整 `scripts/` 目录。商用前核对 `LICENSE.txt`。

默认挂载建议：新建 `document` Agent，**不要**默认挂到 `cashflow`。

### 8.5 CliProcessRunner 设计要点

```yaml
# application.yml 建议配置
agent:
  skill:
    work-root: ${java.io.tmpdir}/efloow-skill-work
    cli:
      enabled: true
      default-timeout-ms: 120000
      max-stdout-bytes: 524288
      allowed-commands:
        - python
        - python3
        - pandoc
        - pdftoppm
        - pdftotext
        - qpdf
      # strict: 不在名单内则拒绝；relaxed: 记录 WARN 后仍拒绝（生产同 strict）
```

| 约束 | strict | relaxed |
|------|--------|---------|
| 调用方式 | `ProcessBuilder(String... argv)` | 同左 |
| Shell 拼接 | **禁止** `sh -c` / `cmd /c` | 同左 |
| 工作目录 | 会话 `workspace/`，禁止 `..` 逃逸 | 同左 |
| 环境变量 | 清空后仅注入 `PATH`、`PYTHONPATH`（指向 skill scripts） | 同左 |
| 网络 | 默认禁止子进程出站 | 可配置 |
| 审计 | traceId、skillCode、argv、exitCode、stdout 摘要 | 同左 |

错误码建议：`T010_CLI_NOT_ALLOWED`、`T011_CLI_TIMEOUT`、`T012_CLI_EXIT_NONZERO`（见附录 E 扩展）。

### 8.6 Tool 封装与 Skill 正文映射

Skill 正文保留业界 bash 示例（便于人类阅读）；平台在 `SKILL.md` 末尾增加 **Platform Tool Mapping** 附录，或在 System Prompt 注入：

| Skill 正文示例 | 平台 Tool Key | 主要参数 |
|----------------|---------------|----------|
| `python scripts/office/unpack.py in out/` | `document.office.unpack` | `inputPath`, `outputDir`, `mergeRuns?` |
| `python scripts/office/pack.py dir out.docx` | `document.office.pack` | `inputDir`, `outputPath`, `originalPath?` |
| `python scripts/office/validate.py file` | `document.office.validate` | `targetPath` |
| `python scripts/recalc.py file.xlsx` | `document.xlsx.recalc` | `inputPath`, `timeoutSeconds?` |
| `pandoc ...` | `document.pandoc.convert` | `inputPath`, `outputPath`, `extraArgs?`（受限） |
| `pdftoppm ...` | `document.pdf.to-images` | `inputPath`, `outputPrefix`, `dpi?` |
| `extract-text file.docx` | `document.extract-text` | `inputPath`, `format?` |

ReAct 调用格式（与现有 Agent 一致）：

```text
ACTION: document.office.unpack | {"inputPath":"workspace/input/report.docx","outputDir":"workspace/unpacked/"}
```

`policy_json.tools.mode = allowlist` 时，Document Skill 仅允许上表 Tool Key。

### 8.7 运行环境与部署

Document Skills 依赖以下**宿主机或 sidecar 镜像**预装组件（按需裁剪）：

| 组件 | 用途 | 备注 |
|------|------|------|
| Python 3.10+ | 运行 `scripts/office/*.py` | 与 Skill 包同版本 vendoring |
| pandoc | docx ↔ markdown | docx skill 读内容 |
| poppler-utils | `pdftoppm` / `pdftotext` | pdf/pptx 预览 |
| LibreOffice (`soffice`) | doc/xlsx 转换、接受修订 | 经 `scripts/office/soffice.py` 包装 |
| Node.js（可选） | `docx` / `pptxgenjs` npm 包 | 新建文档场景 |

生产建议：LibreOffice 与主 JVM **进程隔离**（独立容器 / sidecar），`CliProcessRunner` 通过本地 socket 或受限 exec 调用，避免 GUI 与 Unix socket 问题（`soffice.py` 已考虑沙箱环境）。

### 8.8 与 PolicyGate / ConfirmGate 集成

执行 CLI Tool 前统一判定：

1. `SkillActionType.SCRIPT` ← `policy_json.scripts.mode`
2. 若写输出文件 ← `SkillActionType.FILESYSTEM_WRITE` + path glob
3. `side_effect_level >= high` ← 强制 Confirm（即使 mode=allow）
4. 确认载荷 `action_fingerprint` = `sha256(toolKey + canonicalJson(argv) + outputPaths)`

`SkillExecutor` **不**直接调用 `CliProcessRunner`；一律经 `ToolExecutor.invoke(toolKey, params)`，与现有 Trace / RBAC 一致。

---

## 9. 实施分期

| 阶段 | 交付物 | 状态 |
|------|--------|------|
| **P1** | 表结构 + Parser + Registry；默认 policy；PolicyGate + 复用 Confirm API；Skill CRUD API | ✅ |
| **P2** | 管理台可视化策略编辑；import/export；`agent_skill` 挂载 | ✅ |
| **P3** | paths 路由；pgvector；`context: fork` | ✅ |
| **P4a** | **Skill zip 目录导入**；`sys_skill_resource` CRUD；`SkillResourceMaterializer` | ✅ |
| **P4b** | **`CliProcessRunner`** + `application.yml` 白名单；`runtime_kind=CLI` | ✅ |
| **P4c** | **Document Tool 集**（unpack/pack/validate/recalc/extract-text/pandoc/pdf-to-images） | ✅ |
| **P4d** | Document Skills 种子（docx/pdf/pptx/xlsx）+ `document` Agent 挂载；Docker 依赖镜像 | ✅ |
| **P5** | 租户策略 `sys_tenant_skill_policy`；路由 rerank；CLI sidecar 生产加固 | 待做 |

---

## 附录 A：`execution_policy` JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://efloow.ai/schemas/skill-execution-policy/v1",
  "title": "SkillExecutionPolicy",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "network": { "$ref": "#/$defs/networkPolicy" },
    "filesystem_write": { "$ref": "#/$defs/filesystemWritePolicy" },
    "scripts": { "$ref": "#/$defs/scriptsPolicy" },
    "tools": { "$ref": "#/$defs/toolsPolicy" },
    "side_effect_level": {
      "type": "string",
      "enum": ["none", "low", "medium", "high", "critical"],
      "default": "medium"
    },
    "auto_invoke": {
      "type": "boolean",
      "default": true,
      "description": "false 等价于 disable-model-invocation: true"
    },
    "context": {
      "type": "string",
      "enum": ["inline", "fork"],
      "default": "inline"
    }
  },
  "$defs": {
    "accessMode": {
      "type": "string",
      "enum": ["deny", "allow_with_confirm", "allow"]
    },
    "networkPolicy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "mode": { "$ref": "#/$defs/accessMode", "default": "allow_with_confirm" },
        "allowlist": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "default": [],
          "description": "域名或 host 白名单；空数组表示不限制域名"
        }
      },
      "required": ["mode"]
    },
    "filesystemWritePolicy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "mode": { "$ref": "#/$defs/accessMode", "default": "allow_with_confirm" },
        "paths": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "default": ["**"],
          "description": "允许写入的路径 glob"
        }
      },
      "required": ["mode"]
    },
    "scriptsPolicy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "mode": { "$ref": "#/$defs/accessMode", "default": "allow_with_confirm" },
        "sandbox": {
          "type": "string",
          "enum": ["strict", "relaxed"],
          "default": "strict"
        }
      },
      "required": ["mode"]
    },
    "toolsPolicy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "mode": {
          "type": "string",
          "enum": ["inherit", "allowlist", "denylist"],
          "default": "inherit"
        },
        "allowlist": {
          "type": "array",
          "items": { "type": "string" },
          "default": []
        },
        "denylist": {
          "type": "array",
          "items": { "type": "string" },
          "default": []
        }
      },
      "required": ["mode"]
    }
  }
}
```

### A.1 平台默认 `policy_json` 示例

```json
{
  "network": { "mode": "allow_with_confirm", "allowlist": [] },
  "filesystem_write": { "mode": "allow_with_confirm", "paths": ["**"] },
  "scripts": { "mode": "allow_with_confirm", "sandbox": "strict" },
  "tools": { "mode": "inherit", "allowlist": [], "denylist": [] },
  "side_effect_level": "medium",
  "auto_invoke": true,
  "context": "inline"
}
```

### A.2 策略合并规则（伪代码）

```text
function mergePolicy(l0, l1, l2, l3, l4):
  for each dimension in [network, filesystem_write, scripts, tools]:
    mode = strictest(l4, l3, l2, l1.cap, l0)
    allowlist = intersect_nonempty(l4, l3, l2, l1, l0)  # 越交越窄
  side_effect_level = max_level(all layers)
  auto_invoke = all layers allow auto_invoke
  context = fork if any layer requires fork else inline
```

`strictest`: deny > allow_with_confirm > allow

---

## 附录 B：数据库 Migration SQL 草案

> 文件建议路径：`database/init/013_skill_registry.sql`  
> 遵循项目规范：`timestamp(6)`、`LOCALTIMESTAMP(6)`、公共字段、`status` 逻辑删除。

```sql
-- ============================================================================
-- 13.x Skill 注册中心
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys_skill (
    id                  text NOT NULL,
    skill_code          text NOT NULL,
    skill_name          text NOT NULL,
    description         text NOT NULL,
    category            text,
    tags                jsonb,
    content_md          text,
    frontmatter_json    jsonb,
    policy_json         jsonb NOT NULL DEFAULT '{
        "network": {"mode": "allow_with_confirm", "allowlist": []},
        "filesystem_write": {"mode": "allow_with_confirm", "paths": ["**"]},
        "scripts": {"mode": "allow_with_confirm", "sandbox": "strict"},
        "tools": {"mode": "inherit", "allowlist": [], "denylist": []},
        "side_effect_level": "medium",
        "auto_invoke": true,
        "context": "inline"
    }'::jsonb,
    paths_json          jsonb,
    side_effect_level   text NOT NULL DEFAULT 'medium',
    context_mode        text NOT NULL DEFAULT 'inline',
    auto_invoke         int4 NOT NULL DEFAULT 1,
    require_confirm     int4 NOT NULL DEFAULT 1,
    version             text NOT NULL DEFAULT '1.0.0',
    publish_status      text NOT NULL DEFAULT 'draft',
    is_enabled          int4 NOT NULL DEFAULT 0,
    sort_order          int4 NOT NULL DEFAULT 0,
    owner               text,
    status              int4 NOT NULL DEFAULT 1,
    remark              text,
    create_by           text,
    create_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by           text,
    update_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_skill_pkey PRIMARY KEY (id),
    CONSTRAINT sys_skill_code_unique UNIQUE (skill_code)
);

COMMENT ON TABLE sys_skill IS 'Skill 注册中心：Agent Skills 标准包的管理与发布态';
COMMENT ON COLUMN sys_skill.id IS '主键 ID';
COMMENT ON COLUMN sys_skill.skill_code IS 'Skill 唯一标识，对应 SKILL.md name 与目录名';
COMMENT ON COLUMN sys_skill.skill_name IS 'Skill 展示名称';
COMMENT ON COLUMN sys_skill.description IS 'Skill 短描述，用于路由与目录展示';
COMMENT ON COLUMN sys_skill.category IS '分类: shipping/diagnostics/report 等';
COMMENT ON COLUMN sys_skill.tags IS '标签 JSON 数组，用于路由过滤';
COMMENT ON COLUMN sys_skill.content_md IS 'SKILL.md Markdown 正文（不含 frontmatter）';
COMMENT ON COLUMN sys_skill.frontmatter_json IS '解析后的 YAML frontmatter 完整 JSON';
COMMENT ON COLUMN sys_skill.policy_json IS '执行策略 execution_policy，见附录 A';
COMMENT ON COLUMN sys_skill.paths_json IS 'paths glob 数组，文件切片触发';
COMMENT ON COLUMN sys_skill.side_effect_level IS '副作用等级: none/low/medium/high/critical';
COMMENT ON COLUMN sys_skill.context_mode IS '执行上下文: inline=注入主会话, fork=子 Agent 隔离';
COMMENT ON COLUMN sys_skill.auto_invoke IS '是否允许模型自动触发: 0=否(等同 disable-model-invocation), 1=是';
COMMENT ON COLUMN sys_skill.require_confirm IS '是否启用强确认总开关: 0=关, 1=开';
COMMENT ON COLUMN sys_skill.version IS '当前版本号';
COMMENT ON COLUMN sys_skill.publish_status IS '发布状态: draft=草稿, published=已发布';
COMMENT ON COLUMN sys_skill.is_enabled IS '是否启用: 0=禁用, 1=启用';
COMMENT ON COLUMN sys_skill.sort_order IS '排序号';
COMMENT ON COLUMN sys_skill.owner IS '负责人';
COMMENT ON COLUMN sys_skill.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_skill.remark IS '备注';
COMMENT ON COLUMN sys_skill.create_by IS '创建人';
COMMENT ON COLUMN sys_skill.create_time IS '创建时间';
COMMENT ON COLUMN sys_skill.update_by IS '更新人';
COMMENT ON COLUMN sys_skill.update_time IS '更新时间';

CREATE TABLE IF NOT EXISTS sys_skill_version (
    id                  text NOT NULL,
    skill_id            text NOT NULL,
    version             text NOT NULL,
    content_md          text,
    frontmatter_json    jsonb,
    policy_json         jsonb NOT NULL,
    paths_json          jsonb,
    change_summary      text,
    publish_status      text NOT NULL DEFAULT 'draft',
    status              int4 NOT NULL DEFAULT 1,
    remark              text,
    create_by           text,
    create_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by           text,
    update_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_skill_version_pkey PRIMARY KEY (id),
    CONSTRAINT sys_skill_version_skill_version_unique UNIQUE (skill_id, version)
);

COMMENT ON TABLE sys_skill_version IS 'Skill 版本历史';
COMMENT ON COLUMN sys_skill_version.skill_id IS '关联 sys_skill.id';
COMMENT ON COLUMN sys_skill_version.version IS '版本号';
COMMENT ON COLUMN sys_skill_version.change_summary IS '变更摘要';
COMMENT ON COLUMN sys_skill_version.publish_status IS '版本状态: draft/published/archived';

CREATE TABLE IF NOT EXISTS sys_skill_resource (
    id                  text NOT NULL,
    skill_id            text NOT NULL,
    resource_path       text NOT NULL,
    resource_kind       text NOT NULL DEFAULT 'reference',
    content_text        text,
    storage_uri         text,
    status              int4 NOT NULL DEFAULT 1,
    remark              text,
    create_by           text,
    create_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by           text,
    update_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_skill_resource_pkey PRIMARY KEY (id),
    CONSTRAINT sys_skill_resource_path_unique UNIQUE (skill_id, resource_path)
);

COMMENT ON TABLE sys_skill_resource IS 'Skill 附属资源: references/scripts/assets';
COMMENT ON COLUMN sys_skill_resource.resource_kind IS '资源类型: reference/script/asset';
COMMENT ON COLUMN sys_skill_resource.resource_path IS 'Skill 包内相对路径';
COMMENT ON COLUMN sys_skill_resource.storage_uri IS '大文件对象存储 URI';

CREATE TABLE IF NOT EXISTS agent_skill (
    id                  text NOT NULL,
    agent_id            text NOT NULL,
    skill_id            text NOT NULL,
    policy_override     jsonb,
    is_default          int4 NOT NULL DEFAULT 0,
    sort_order          int4 NOT NULL DEFAULT 0,
    status              int4 NOT NULL DEFAULT 1,
    remark              text,
    create_by           text,
    create_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by           text,
    update_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT agent_skill_pkey PRIMARY KEY (id),
    CONSTRAINT agent_skill_agent_skill_unique UNIQUE (agent_id, skill_id)
);

COMMENT ON TABLE agent_skill IS 'Agent 挂载 Skill 及策略 override';
COMMENT ON COLUMN agent_skill.policy_override IS '挂载级 execution_policy 覆盖，合并时取更严';
COMMENT ON COLUMN agent_skill.is_default IS '是否为该 Agent 默认 Skill: 0=否, 1=是';

CREATE TABLE IF NOT EXISTS sys_tenant_skill_policy (
    id                  text NOT NULL,
    tenant_id           text NOT NULL,
    policy_cap_json     jsonb NOT NULL,
    status              int4 NOT NULL DEFAULT 1,
    remark              text,
    create_by           text,
    create_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by           text,
    update_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_tenant_skill_policy_pkey PRIMARY KEY (id),
    CONSTRAINT sys_tenant_skill_policy_tenant_unique UNIQUE (tenant_id)
);

COMMENT ON TABLE sys_tenant_skill_policy IS '租户级 Skill 执行策略上限';
COMMENT ON COLUMN sys_tenant_skill_policy.policy_cap_json IS '策略上限，Skill 级配置不得比此更松';

CREATE TABLE IF NOT EXISTS sys_skill_confirm_audit (
    id                  text NOT NULL,
    trace_id            text NOT NULL,
    session_id          text NOT NULL,
    user_id             text,
    skill_code          text NOT NULL,
    skill_version       text,
    confirm_id          text NOT NULL,
    action_type         text NOT NULL,
    action_fingerprint  text NOT NULL,
    risk_level          text NOT NULL,
    policy_snapshot     jsonb,
    confirm_payload     jsonb,
    decision            text NOT NULL,
    decision_comment    text,
    decided_at          timestamp(6),
    status              int4 NOT NULL DEFAULT 1,
    remark              text,
    create_by           text,
    create_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by           text,
    update_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_skill_confirm_audit_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE sys_skill_confirm_audit IS 'Skill 强确认审计表（不可变表，仅 INSERT）';
COMMENT ON COLUMN sys_skill_confirm_audit.action_fingerprint IS '动作指纹，防止 confirmId 复用于不同动作';
COMMENT ON COLUMN sys_skill_confirm_audit.decision IS '决策: approved/denied/expired';
COMMENT ON COLUMN sys_skill_confirm_audit.update_by IS '不可变表：始终为空';
COMMENT ON COLUMN sys_skill_confirm_audit.update_time IS '不可变表：始终为默认值';

-- 可选：100+ Skill 时启用向量路由
CREATE TABLE IF NOT EXISTS sys_skill_embedding (
    id                  text NOT NULL,
    skill_id            text NOT NULL,
    embedding_model     text NOT NULL,
    embedding_vector    vector(1536),
    routing_text        text NOT NULL,
    status              int4 NOT NULL DEFAULT 1,
    remark              text,
    create_by           text,
    create_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by           text,
    update_time         timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_skill_embedding_pkey PRIMARY KEY (id),
    CONSTRAINT sys_skill_embedding_skill_unique UNIQUE (skill_id, embedding_model)
);

COMMENT ON TABLE sys_skill_embedding IS 'Skill 路由向量索引';
COMMENT ON COLUMN sys_skill_embedding.routing_text IS '嵌入文本，通常为 name + description + tags';

CREATE INDEX IF NOT EXISTS idx_sys_skill_enabled
    ON sys_skill (is_enabled, publish_status)
    WHERE status <> 2;

CREATE INDEX IF NOT EXISTS idx_agent_skill_agent
    ON agent_skill (agent_id)
    WHERE status <> 2;
```

---

## 附录 C：API OpenAPI 片段

### C.1 Skill CRUD

```yaml
openapi: 3.0.3
info:
  title: Skill Registry API
  version: 1.0.0

paths:
  /api/skills:
    get:
      summary: Skill 列表（仅元数据，渐进披露 L0）
      tags: [Skill]
      parameters:
        - name: agentId
          in: query
          schema: { type: string }
          description: 按 Agent 挂载过滤
        - name: enabled
          in: query
          schema: { type: boolean }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RSkillList'

    post:
      summary: 创建 Skill 草稿
      tags: [Skill]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SkillUpsertRequest'
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RSkillDetail'

  /api/skills/{id}:
    get:
      summary: Skill 详情（含 content_md、policy_json）
      tags: [Skill]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RSkillDetail'

    put:
      summary: 更新 Skill
      tags: [Skill]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SkillUpsertRequest'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RSkillDetail'

    delete:
      summary: 逻辑删除 Skill
      tags: [Skill]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RVoid'

  /api/skills/{id}/publish:
    post:
      summary: 发布 Skill 并刷新运行时 Registry
      tags: [Skill]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RSkillDetail'

  /api/skills/import:
    post:
      summary: 导入 SKILL.md 或目录 zip
      tags: [Skill]
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RSkillDetail'

  /api/skills/{id}/export:
    get:
      summary: 导出为标准 Skill 目录 zip
      tags: [Skill]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          content:
            application/zip:
              schema:
                type: string
                format: binary

  /api/skills/test-route:
    post:
      summary: 路由仿真
      tags: [Skill]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SkillRouteTestRequest'
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RSkillRouteTestResult'

components:
  schemas:
    SkillSummary:
      type: object
      required: [id, skillCode, skillName, description, isEnabled]
      properties:
        id: { type: string }
        skillCode: { type: string }
        skillName: { type: string }
        description: { type: string, maxLength: 1024 }
        category: { type: string }
        tags: { type: array, items: { type: string } }
        sideEffectLevel:
          type: string
          enum: [none, low, medium, high, critical]
        autoInvoke: { type: boolean }
        isEnabled: { type: boolean }
        version: { type: string }

    SkillDetail:
      allOf:
        - $ref: '#/components/schemas/SkillSummary'
        - type: object
          properties:
            contentMd: { type: string }
            frontmatterJson: { type: object, additionalProperties: true }
            policyJson: { type: object, additionalProperties: true }
            pathsJson: { type: array, items: { type: string } }
            contextMode: { type: string, enum: [inline, fork] }
            requireConfirm: { type: boolean }
            publishStatus: { type: string, enum: [draft, published] }

    SkillUpsertRequest:
      type: object
      required: [skillCode, skillName, description]
      properties:
        skillCode:
          type: string
          pattern: '^[a-z0-9]+(-[a-z0-9]+)*$'
          maxLength: 64
        skillName: { type: string }
        description: { type: string, maxLength: 1024 }
        category: { type: string }
        tags: { type: array, items: { type: string } }
        contentMd: { type: string }
        policyJson: { type: object, additionalProperties: true }
        pathsJson: { type: array, items: { type: string } }
        autoInvoke: { type: boolean, default: true }
        requireConfirm: { type: boolean, default: true }
        contextMode: { type: string, enum: [inline, fork], default: inline }

    SkillRouteTestRequest:
      type: object
      required: [inputText]
      properties:
        inputText: { type: string }
        agentId: { type: string }
        workspacePaths:
          type: array
          items: { type: string }
          description: 模拟当前工作区文件路径，用于 paths 路由
        topK: { type: integer, default: 5, minimum: 1, maximum: 20 }

    SkillRouteCandidate:
      type: object
      properties:
        skillCode: { type: string }
        score: { type: number, format: float }
        reason: { type: string }
        matchedBy:
          type: string
          enum: [explicit, paths, embedding, llm, default]

    SkillRouteTestResult:
      type: object
      properties:
        selectedSkillCode: { type: string, nullable: true }
        candidates:
          type: array
          items:
            $ref: '#/components/schemas/SkillRouteCandidate'

    RSkillList:
      type: object
      properties:
        success: { type: boolean }
        code: { type: string }
        message: { type: string }
        data:
          type: array
          items:
            $ref: '#/components/schemas/SkillSummary'

    RSkillDetail:
      type: object
      properties:
        success: { type: boolean }
        code: { type: string }
        message: { type: string }
        data:
          $ref: '#/components/schemas/SkillDetail'

    RVoid:
      type: object
      properties:
        success: { type: boolean }
        code: { type: string }
        message: { type: string }
```

### C.2 Skill 强确认（扩展现有 Agent Confirm）

复用 `POST /api/agent/confirm`；SSE `confirm_request` 事件的 `detail` 扩展如下。

#### C.2.1 SSE `confirm_request` 载荷扩展

```json
{
  "type": "confirm_request",
  "message": "Skill 即将执行写操作，请确认",
  "data": {
    "confirmId": "cfm-8f3a2b1c",
    "sessionId": "sess-001",
    "action": "skill.filesystem_write",
    "description": "将写入 dist/app.js 并 POST https://api.example.com/deploy",
    "riskLevel": "HIGH",
    "skillCode": "deploy-staging",
    "skillVersion": "1.2.0",
    "actionType": "filesystem_write",
    "policySource": "skill.policy_json.filesystem_write",
    "expiresAt": "2026-05-26T22:45:00",
    "detail": {
      "writePaths": ["dist/app.js"],
      "urls": ["https://api.example.com/deploy"],
      "script": null,
      "actionFingerprint": "sha256:abc123..."
    }
  }
}
```

#### C.2.2 HTTP Confirm 请求（不变）

```yaml
/api/agent/confirm:
  post:
    summary: 用户确认或拒绝 Skill/Tool 副作用动作
    tags: [Agent]
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/AgentConfirmRequest'
    responses:
      '200':
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AgentConfirmResponse'

components:
  schemas:
    AgentConfirmRequest:
      type: object
      required: [sessionId, confirmId, approved]
      properties:
        sessionId: { type: string }
        confirmId: { type: string }
        approved: { type: boolean }
        comment:
          type: string
          description: 用户备注，deny 时建议填写原因

    AgentConfirmResponse:
      type: object
      properties:
        success: { type: boolean }
        traceId: { type: string }
        code: { type: string }
        message: { type: string }
        data:
          type: object
          properties:
            confirmed: { type: boolean }
            confirmId: { type: string }
```

#### C.2.3 确认审计写入（服务端内部）

确认/拒绝/超时后，异步 INSERT `sys_skill_confirm_audit`：

| 字段 | 示例 |
|------|------|
| `confirm_id` | `cfm-8f3a2b1c` |
| `action_fingerprint` | `sha256(...)` |
| `decision` | `approved` / `denied` / `expired` |
| `policy_snapshot` | 合并后的 effective policy JSON |

---

## 附录 D：SKILL.md 导入校验清单

| 校验项 | 规则 |
|--------|------|
| name 格式 | `^[a-z0-9]+(-[a-z0-9]+)*$`，≤64 字符 |
| description | 非空，≤1024 字符 |
| skill_code 唯一 | DB 内不重复 |
| policy_json | 符合附录 A Schema |
| paths | 合法 glob |
| 附属文件 | `SKILL.md` 引用的路径必须存在 |
| 发布 | `publish_status=published` 且 `is_enabled=1` 才进入 Runtime Registry |

---

## 附录 E：错误码建议

| 错误码 | 含义 |
|--------|------|
| `S001_SKILL_NOT_FOUND` | Skill 不存在或未发布 |
| `S002_SKILL_POLICY_DENIED` | 执行策略 deny |
| `S003_SKILL_CONFIRM_REQUIRED` | 需确认但未收到 approved |
| `S004_SKILL_CONFIRM_DENIED` | 用户拒绝 |
| `S005_SKILL_CONFIRM_EXPIRED` | 确认超时 |
| `S006_SKILL_PARSE_INVALID` | SKILL.md 解析/校验失败 |
| `S007_SKILL_ROUTE_NO_MATCH` | 路由无候选 |
| `S008_SKILL_RESOURCE_MISSING` | 正文引用的 scripts/references 路径未入库 |
| `T010_CLI_NOT_ALLOWED` | CLI 命令不在白名单或 argv 非法 |
| `T011_CLI_TIMEOUT` | CLI 子进程超时 |
| `T012_CLI_EXIT_NONZERO` | CLI 退出码非 0 |

---

## 附录 F：Document Tool Mapping（速查）

| Tool Key | 替代 Skill 正文命令 | side_effect |
|----------|---------------------|-------------|
| `document.office.unpack` | `python scripts/office/unpack.py` | write |
| `document.office.pack` | `python scripts/office/pack.py` | write |
| `document.office.validate` | `python scripts/office/validate.py` | none |
| `document.xlsx.recalc` | `python scripts/recalc.py` | write |
| `document.extract-text` | `extract-text {file}` | none |
| `document.pandoc.convert` | `pandoc ...` | write |
| `document.pdf.to-images` | `pdftoppm ...` | write |

完整设计见 **§8.6**。

---

*文档结束*
