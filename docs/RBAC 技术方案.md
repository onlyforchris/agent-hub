# RBAC 技术方案

更新时间：2026-04-30

## 1. 目标

RBAC 模块负责回答三个问题：

- 谁可以登录系统。
- 谁可以访问某个后端 API、菜单路由和 Agent。
- 当权限配置变化后，系统如何及时生效并保持可审计、可扩展。

当前方案基于 Spring Security + JWT + 数据库权限表实现，后端以 `sys_resource.resource_code` 作为 API 权限判断依据，前端以登录态中的菜单、权限码和 Agent ID 控制页面展示与入口。

## 2. 产品设计说明

### 2.1 产品目标

RBAC 不是单纯的“后台技术权限”，它在产品上要解决四类问题：

- 不同岗位看到不同功能：例如普通业务人员只看到工作台和已授权 Agent，管理员可以看到系统配置。
- 不同岗位能做不同操作：例如有人只能查看用户，有人可以新增用户，有人可以给角色授权。
- 不同人员能使用不同 Agent：例如司库操作员能使用预测 Agent 和风险 Agent，但不能访问未授权 Agent。
- 出现权限问题时可追踪：能知道谁在什么时候访问了什么接口，结果是成功、未登录还是无权限。

### 2.2 核心产品概念

| 概念 | 产品含义 | 示例 |
| --- | --- | --- |
| 用户 | 一个登录账号 | 张三、李四、admin |
| 角色 | 一组权限的集合，通常对应岗位 | 超级管理员、司库操作员、审计员 |
| 菜单权限 | 控制用户能看到哪些导航和页面 | 智能体、工具、技能、智能体配置 |
| 操作权限 | 控制用户能不能点击某类按钮或调用某类接口 | 新增用户、删除角色、角色授权 |
| Agent 权限 | 控制用户能使用哪些智能体 | 预测 Agent、归因 Agent、风险 Agent |
| 数据范围 | 控制用户能看到多大范围的数据 | 仅本人、本部门、全部 |

产品上可以把“角色”理解为一个权限包。管理员先维护角色，再把角色分配给用户。

### 2.3 推荐的角色设计

MVP 阶段建议先保留少量清晰角色，避免权限颗粒度过细导致配置困难。

| 角色 | 适用对象 | 建议权限 |
| --- | --- | --- |
| 超级管理员 | 系统负责人、实施负责人 | 所有菜单、所有操作、所有 Agent、全部数据 |
| RBAC 管理员 | 负责账号和权限配置的人 | 用户、角色、菜单、资源、Agent 授权管理 |
| 司库操作员 | 日常业务用户 | 智能体工作台、已授权 Agent、基础查询 |
| 只读审计员 | 审计或管理查看人员 | 历史记录、配置查看，不允许新增/修改/删除 |

后续业务扩展时，可以按岗位继续拆分，例如“资金预测专员”“风险监控专员”“工具管理员”。

### 2.4 权限配置流程

后台管理员的典型操作流程：

1. 新增或确认菜单：决定这个角色能看到哪些页面入口。
2. 新增或确认资源：决定这个角色能调用哪些后端能力。
3. 新增或确认 Agent：决定这个角色能使用哪些智能体。
4. 创建角色：例如“司库操作员”。
5. 给角色分配菜单、资源和 Agent。
6. 给用户分配角色。
7. 用户重新登录或刷新当前用户信息后，看到新的菜单、按钮和 Agent。

产品交互上，建议把授权页面做成三个清晰区域：

- 菜单授权：树形勾选。
- 操作授权：按模块分组勾选，例如用户管理、角色管理、Agent 管理。
- Agent 授权：Agent 列表勾选。

### 2.5 用户侧体验

用户登录后，系统根据权限自动决定：

- 左侧或顶部导航显示哪些菜单。
- 页面里哪些按钮显示，哪些按钮隐藏。
- Agent 工作台里能看到哪些 Agent。
- 请求无权限能力时是否返回 403 提示。

建议的前端提示：

| 场景 | 产品提示 |
| --- | --- |
| 未登录或登录过期 | 登录已过期，请重新登录 |
| 已登录但无权限 | 当前账号无权访问该资源 |
| Agent 未授权 | 当前账号无权使用该智能体 |
| 资源未登记 | 当前功能暂未开放，请联系管理员 |

按钮级权限建议默认“隐藏无权限按钮”。对用户需要理解但不能操作的关键动作，可以显示禁用态并配合 Tooltip，例如“无审批权限”。

### 2.6 管理员侧体验

管理员在 RBAC 配置页面应能完成：

- 查看用户列表、创建用户、停用用户、重置密码。
- 查看角色列表、创建角色、编辑角色、删除普通角色。
- 给用户分配角色。
- 给角色分配菜单、操作资源和 Agent。
- 查看资源列表，配置路径匹配方式。
- 查看审计日志，追踪访问结果。

重要产品约束：

- `SUPER_ADMIN` 类型角色不能被普通管理员删除。
- `SUPER_ADMIN` 类型角色的 `role_type` 不允许在页面上被改成普通角色。
- 默认内置 admin 用户只是绑定了超级管理员角色，不再因为用户名叫 admin 而天然拥有权限。
- 删除角色前应提示影响范围，例如“该角色已分配给 3 个用户”。

### 2.7 审计日志的产品价值

审计日志用于回答：

- 谁访问了系统。
- 访问了哪个功能或接口。
- 访问结果是成功、未登录、无权限还是失败。
- 发生问题时对应的 traceId 是什么。

产品上建议提供一个“权限审计”页面，支持按以下条件筛选：

- 用户名。
- 访问路径。
- 访问结果。
- 时间范围。
- traceId。

审计页面优先服务排查和合规，不建议做成复杂业务报表。

### 2.8 权限变更生效规则

当前权限变更后，服务端会主动清理相关缓存。产品上可以这样描述：

- 管理员修改角色授权后，新权限会尽快生效。
- 用户正在使用系统时，部分前端展示可能需要刷新页面或重新获取用户信息。
- 对安全敏感的接口，后端会实时按最新权限判断。

如果产品希望“权限变更后用户立即被踢下线”，后续可以增加强制会话失效能力。

### 2.9 当前边界

当前已经具备账号、角色、菜单、操作、Agent 和基础数据范围能力，但还有几个产品边界：

- 数据权限目前是基础模型，具体业务列表还需要逐个接入过滤规则。
- 审计日志当前记录接口访问结果，暂未记录请求体详情。
- 前端 RBAC 管理页还需要补充 `role_type`、`match_type`、`priority`、`data_scope` 等字段的可视化配置。
- 多实例下 Redis 可以共享权限缓存，但本地缓存跨实例实时同步还可以继续增强。

## 3. 当前实现范围

已实现能力：

- 登录认证：账号密码 + 图形验证码，登录成功后签发 JWT。
- API 资源鉴权：请求经 `JwtAuthenticationFilter` 认证后，由 `ResourceAuthorizationFilter` 做资源级权限校验。
- 菜单权限：通过 `sys_role_menu` 控制前端可见菜单与路由。
- Agent 权限：通过 `sys_role_agent` 控制用户可访问的 Agent。
- 角色授权：支持给角色分配菜单、资源、Agent。
- 用户授权：支持给用户分配角色。
- 超级管理员：通过 `sys_role.role_type = 'SUPER_ADMIN'` 识别，不再依赖用户名硬编码。
- 动态路径匹配：`sys_resource` 支持精确匹配和 Ant 风格路径匹配。
- 未登记资源保护：受保护 API 若没有登记资源，默认返回 403。
- 权限缓存：按用户缓存权限码和 Agent ID，授权变更后主动失效。
- Token 生命周期：支持 access token + refresh token，logout 后服务端拉黑 access token 并撤销 refresh token。
- 权限审计：记录 `/api/**` 访问人、路径、结果、耗时和 traceId。
- 数据权限基础模型：用户角色关系支持 `data_scope`，可计算用户最宽数据范围。
- 前端权限组件：提供 React `Permission` 组件和 `usePermission` Hook。

## 4. 数据模型

核心表：

| 表 | 职责 |
| --- | --- |
| `sys_user` | 系统用户，保存账号、密码哈希、部门、状态、登录信息 |
| `sys_role` | 角色定义，包含 `role_type` |
| `sys_menu` | 前端菜单与路由权限 |
| `sys_resource` | 后端 API 资源权限 |
| `sys_user_role` | 用户与角色关系 |
| `sys_role_menu` | 角色与菜单关系 |
| `sys_role_resource` | 角色与 API 资源关系 |
| `sys_role_agent` | 角色与 Agent 关系 |
| `sys_refresh_token` | Refresh Token 服务端状态 |
| `sys_token_blacklist` | Access/Refresh Token 黑名单 |
| `sys_audit_access` | API 访问审计日志 |
| `agent` | Agent 目录 |

`sys_role.role_type`：

| 值 | 含义 |
| --- | --- |
| `NORMAL` | 普通角色 |
| `SUPER_ADMIN` | 超级管理员角色，跳过资源权限和 Agent 权限校验 |

`sys_resource` 关键字段：

| 字段 | 含义 |
| --- | --- |
| `resource_code` | 权限码，例如 `system:user:view` |
| `method` | HTTP 方法 |
| `path` | API 路径或 Ant 路径模式 |
| `match_type` | `EXACT` 精确匹配，`ANT` Ant 风格匹配 |
| `priority` | Ant 匹配优先级，数字越大越优先 |
| `status` | 是否启用 |

## 5. 鉴权链路

整体链路：

```text
登录 -> 签发 JWT -> 请求携带 Bearer Token
 -> JwtAuthenticationFilter 校验 JWT 并还原当前用户
 -> ResourceAuthorizationFilter 解析 method + path 对应的 resource_code
 -> RbacService.assertPermission 校验当前用户角色是否拥有该资源权限
 -> Controller / Service 执行业务逻辑
```

资源解析顺序：

1. 先查 `match_type = 'EXACT'` 且 method/path 完全一致的资源。
2. 精确匹配未命中时，查询同 method 下 `match_type = 'ANT'` 的启用资源。
3. 应用层使用 `AntPathMatcher` 按 `priority desc` 顺序匹配。
4. 仍未命中时，按配置的未登记资源策略处理。

默认策略：

- 白名单路径直接放行。
- 已认证即可访问的路径直接放行，不要求额外资源权限。
- 超级管理员角色直接放行。
- 已登记资源必须校验权限码。
- 未登记资源默认拒绝。

## 6. 安全配置

配置位置：`agent-server/agent-server-app/src/main/resources/application.yml`

```yaml
rbac:
  security:
    unregistered-resource-policy: DENY
    public-paths:
      - /api/auth/captcha
      - /api/auth/login
      - /api/auth/refresh
      - /actuator/health
      - /v3/api-docs/**
      - /swagger-ui.html
      - /swagger-ui/**
    authenticated-paths:
      - /api/auth/me
      - /api/auth/logout
      - /api/rbac/menus/routes
```

策略说明：

| 配置 | 含义 |
| --- | --- |
| `public-paths` | 无需登录即可访问 |
| `authenticated-paths` | 登录后即可访问，不再校验资源权限 |
| `unregistered-resource-policy` | 未登记资源策略，推荐保持 `DENY` |

生产环境不建议使用 `ALLOW`。该模式仅用于临时兼容旧接口。

## 7. 权限判断规则

API 权限：

```text
sys_user
 -> sys_user_role
 -> sys_role(status = 1)
 -> sys_role_resource
 -> sys_resource(status = 1)
 -> resource_code
```

菜单权限：

```text
sys_user
 -> sys_user_role
 -> sys_role(status = 1)
 -> sys_role_menu
 -> sys_menu(status = 1)
```

Agent 权限：

```text
sys_user
 -> sys_user_role
 -> sys_role(status = 1)
 -> sys_role_agent
 -> agent(status = 1)
```

超级管理员：

```text
sys_user
 -> sys_user_role
 -> sys_role(role_type = 'SUPER_ADMIN', status = 1)
```

超级管理员不依赖用户名。内置 admin 用户只是默认绑定了 `ADMIN` 角色，而 `ADMIN` 角色被标记为 `SUPER_ADMIN`。

数据权限：

`sys_user_role.data_scope` 表示某个用户通过某个角色获得的数据范围。当前支持：

| 值 | 含义 |
| --- | --- |
| `SELF` | 仅本人 |
| `DEPT` | 本部门 |
| `DEPT_AND_SUB` | 本部门及下级 |
| `ALL` | 全部 |

当前服务端已提供用户最大数据范围计算，后续业务列表可据此接入数据过滤条件。

## 8. 缓存策略

当前使用 Redis + 服务内本地缓存，TTL 30 分钟。Redis 不可用时自动退化为本地缓存。

| 缓存内容 | Key | 失效时机 |
| --- | --- | --- |
| 用户 API 权限码 | userId | 用户角色变更、角色资源变更、资源变更、角色状态变更 |
| 用户 Agent ID | userId | 用户角色变更、角色 Agent 变更、Agent 变更、角色状态变更 |

缓存只用于降低高频查询压力。授权接口在变更后会主动清理相关用户缓存，确保权限变化可以及时反映。

多实例部署下，Redis 缓存可共享权限结果；授权变更时会删除对应用户的 Redis key。

## 9. Token 生命周期

登录成功返回：

- `token`：access token，默认 2 小时有效。
- `refreshToken`：refresh token，默认 7 天有效。

JWT payload 包含：

```json
{
  "jti": "token-id",
  "sub": "userId",
  "userId": "userId",
  "username": "admin",
  "nickname": "Admin",
  "tokenType": "ACCESS",
  "iat": 123,
  "exp": 456
}
```

规则：

- `JwtAuthenticationFilter` 只接受 `tokenType = ACCESS` 的 token。
- `/api/auth/refresh` 只接受 `tokenType = REFRESH` 的 token。
- refresh token 必须在 `sys_refresh_token` 中处于未撤销且未过期状态。
- logout 会把当前 access token 写入 `sys_token_blacklist`，并撤销当前用户所有 refresh token。
- 前端收到 401 后会用 refresh token 尝试换取新的 access token，刷新失败则清理登录态并跳转登录页。

## 10. 权限审计

审计表：`sys_audit_access`

记录内容：

- `trace_id`
- `user_id` / `username`
- `request_method`
- `request_path`
- `access_result`
- `deny_reason`
- `client_ip`
- `user_agent`
- `request_time`
- `response_time_ms`

当前记录所有 `/api/**` 请求。结果按 HTTP 状态归类为 `GRANTED`、`DENIED`、`UNAUTHORIZED`、`FAILED`。

## 11. Controller 显式断言

资源过滤器提供统一 API 入口保护，Controller 仍保留显式权限断言：

```java
rbacService.assertPermission("system:user:view");
rbacService.assertPermission("system:role:grant");
rbacService.assertPermission("system:agent:manage");
```

原因：

- 动态业务动作可以有比 URL 更清晰的权限语义。
- 高风险操作在代码入口处更容易审计。
- 即使资源配置遗漏，业务代码仍有第二层保护。

角色授权查询接口也需要显式断言，例如查询某角色已分配的菜单、资源、Agent 时，需要 `system:role:view`。

## 12. 初始化与迁移

初始化脚本位置：`database/init/002_auth_schema.sql`

新增字段：

```sql
ALTER TABLE sys_role ADD COLUMN IF NOT EXISTS role_type text NOT NULL DEFAULT 'NORMAL';
ALTER TABLE sys_resource ADD COLUMN IF NOT EXISTS match_type text NOT NULL DEFAULT 'EXACT';
ALTER TABLE sys_resource ADD COLUMN IF NOT EXISTS priority int4 NOT NULL DEFAULT 0;
ALTER TABLE sys_user_role ADD COLUMN IF NOT EXISTS data_scope text NOT NULL DEFAULT 'SELF';
```

内置管理员：

```sql
UPDATE sys_role SET role_type = 'SUPER_ADMIN' WHERE role_code = 'ADMIN';
```

动态路径资源会配置为 Ant 模式，例如：

```text
GET    /api/rbac/users/**
PUT    /api/rbac/users/{id}
DELETE /api/rbac/users/{id}
POST   /api/rbac/roles/{roleId}/**
```

Token 与审计相关表：

```sql
CREATE TABLE IF NOT EXISTS sys_refresh_token (...);
CREATE TABLE IF NOT EXISTS sys_token_blacklist (...);
CREATE TABLE IF NOT EXISTS sys_audit_access (...);
```

## 13. 前端权限控制

前端提供：

```tsx
import { Permission, usePermission } from '../components/Permission';

<Permission anyOf="system:user:delete">
  <Button danger>删除</Button>
</Permission>
```

`usePermission` 支持单权限码或权限码数组，数组满足任意一个即返回 `true`。

## 14. 验收标准

- 未登录访问受保护 API 返回 401。
- 已登录但无资源权限访问已登记 API 返回 403。
- 已登录访问未登记受保护 API 默认返回 403。
- `SUPER_ADMIN` 角色用户可以访问受保护资源。
- 非 `SUPER_ADMIN` 用户必须通过角色获得资源权限。
- 动态路径可以通过 Ant 模式命中资源权限，例如 `/api/rbac/users/{id}`。
- 用户只能看到被授权的菜单。
- 用户只能看到被授权的 Agent。
- 未授权 Agent 调用 `/api/orchestrator/ask` 被拒绝。
- 用户角色或角色授权变更后，权限缓存及时失效。
- logout 后旧 access token 不再可用。
- refresh token 被撤销或过期后无法换取新 token。
- `/api/**` 请求会写入访问审计。
- 前端 401 后可以自动刷新 token，刷新失败时回到登录页。


