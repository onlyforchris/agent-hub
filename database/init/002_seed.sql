-- ============================================================================
-- 002_seed.sql — Agent 中台 v2.0 种子数据
--
-- 账号: admin / Eflow@2025  (BCrypt)
-- 超级管理员拥有全部 RBAC 权限
--
-- 删库重建顺序:
--   docker/init.sql          → 扩展 (timescaledb, vector)
--   001_schema.sql           → 表结构
--   002_seed.sql             → 本文件（组织/用户/菜单/资源/Agent）
--   004~008_*.sql            → Text2SQL 等扩展模块（按需）
-- ============================================================================

-- ============================================================================
-- 1. 组织架构
-- ============================================================================
INSERT INTO sys_department (id, parent_id, dept_code, dept_name, sort_order, status, create_by) VALUES
('dept-finance',      '0',               'FINANCE',   '财务部',    1,  1, 'system'),
('dept-sap-project',  '0',               'SAP',       'SAP项目组', 10, 1, 'system'),
('dept-dms-project',  '0',               'DMS',       'DMS项目组', 20, 1, 'system')
ON CONFLICT (dept_code) DO NOTHING;

-- ============================================================================
-- 2. 用户
-- ============================================================================
INSERT INTO sys_user (id, username, password_hash, nickname, department_id, email, status, create_by) VALUES (
    'admin',
    'admin',
    '{bcrypt}$2b$10$V.1l5oZlUI.b/aDL6k.BtOcjeTRfoXr1CrQcTewIlaIaf.dp5HtcC',
    '超级管理员',
    'dept-finance',
    'admin@efloow.local',
    1,
    'system'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 3. 角色
-- ============================================================================
INSERT INTO sys_role (id, role_code, role_name, role_type, status, sort_order, remark, create_by) VALUES
('role-admin',    'ADMIN',              '超级管理员', 'SUPER_ADMIN', 1, 1,  '系统内置, 拥有全部权限',         'system'),
('role-treasury', 'TREASURY_OPERATOR',  '司库操作员', 'NORMAL',       1, 10, '可使用已授权的 Agent',          'system')
ON CONFLICT (role_code) DO NOTHING;

-- ============================================================================
-- 4. 用户-角色关联
-- ============================================================================
INSERT INTO sys_user_role (id, user_id, role_id, data_scope, create_by) VALUES
('ur-admin', 'admin', 'role-admin', 'ALL', 'system')
ON CONFLICT (user_id, role_id) WHERE status <> 2 DO NOTHING;

-- ============================================================================
-- 5. 菜单（icon 使用 Ant Design Outlined 命名，前端 menuIcons.ts 映射 Lucide）
--    RBAC：侧栏仅「系统权限与操作审计」单入口，人员/组织/菜单/资源/角色在页内 Tab
-- ============================================================================
INSERT INTO sys_menu (
    id, parent_id, menu_name, path, component, icon, sort_order, status, permission_code, remark, create_by, update_by
) VALUES
(
    'menu-workspace', '0', 'Agent 工作台', '/dashboard', 'DashboardView', 'RobotOutlined', 10, 1,
    'agent:workspace:view', '运营大盘与 Agent 对话入口', 'system', 'system'
),
(
    'menu-rules-access', '0', '规则与接入', NULL, NULL, 'ApiOutlined', 20, 1,
    NULL, '消息中心与外部系统连接器', 'system', 'system'
),
(
    'menu-message-center', 'menu-rules-access', '消息中心', '/notifications', 'NotificationsView', 'BellOutlined', 10, 1,
    'notification:center:view', '站内通知与消息模板', 'system', 'system'
),
(
    'menu-system-connector', 'menu-rules-access', '系统连接器', '/connectors', 'DataView', 'DatabaseOutlined', 20, 1,
    'connector:datasource:list', 'Text2SQL 外部数据源连接', 'system', 'system'
),
(
    'menu-rbac-root', '0', '系统权限与操作审计', '/settings/rbac', 'AdminRbacConsole', 'ShieldCheckOutlined', 90, 1,
    'system:rbac:view', '权限中心单页，子功能页内 Tab 切换', 'system', 'system'
)
ON CONFLICT (id) DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    menu_name = EXCLUDED.menu_name,
    path = EXCLUDED.path,
    component = EXCLUDED.component,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    permission_code = EXCLUDED.permission_code,
    remark = EXCLUDED.remark,
    update_by = EXCLUDED.update_by,
    update_time = LOCALTIMESTAMP(6);

-- ============================================================================
-- 6. API 资源
-- ============================================================================
INSERT INTO sys_resource (id, menu_id, resource_name, resource_code, method, path, resource_type, match_type, priority, status, create_by) VALUES

-- === 认证 ===
('res-auth-me',         NULL,            '当前用户信息',     'auth:me:view',         'GET',    '/api/auth/me',              'API', 'EXACT', 0, 1, 'system'),
('res-auth-logout',     NULL,            '退出登录',         'auth:logout',          'POST',   '/api/auth/logout',          'API', 'EXACT', 0, 1, 'system'),
('res-menu-routes',     'menu-rbac-root',    '当前用户路由',     'system:menu:routes',   'GET',    '/api/rbac/menus/routes',     'API', 'EXACT', 0, 1, 'system'),

-- === Agent 工作台 ===
('res-agent-ask',       'menu-workspace', 'Agent 对话',      'agent:ask',            'POST',   '/api/agent/ask',             'API', 'EXACT', 0, 1, 'system'),
('res-agent-ask-stream','menu-workspace', 'Agent 流式对话',   'agent:ask:stream',     'POST',   '/api/agent/ask/stream',      'API', 'EXACT', 0, 1, 'system'),
('res-agent-catalog',   'menu-workspace', 'Agent 目录',      'agent:catalog:view',   'GET',    '/api/agent/catalog',         'API', 'EXACT', 0, 1, 'system'),
('res-agent-list',      'menu-workspace', '已授权 Agent 列表', 'system:agent:view',   'GET',    '/api/agents',                'API', 'EXACT', 0, 1, 'system'),

-- === 管理后台 — 组织 ===
('res-dept-view',       'menu-rbac-root',    '查看组织',         'system:dept:view',     'GET',    '/api/rbac/departments/**',    'API', 'ANT', 10, 1, 'system'),
('res-dept-add',        'menu-rbac-root',    '新增组织',         'system:dept:add',      'POST',   '/api/rbac/departments',       'API', 'EXACT', 0, 1, 'system'),
('res-dept-edit',       'menu-rbac-root',    '编辑组织',         'system:dept:edit',     'PUT',    '/api/rbac/departments/{id}',  'API', 'ANT', 10, 1, 'system'),
('res-dept-delete',     'menu-rbac-root',    '删除组织',         'system:dept:delete',   'DELETE', '/api/rbac/departments/{id}',  'API', 'ANT', 10, 1, 'system'),

-- === 管理后台 — 用户 ===
('res-user-view',       'menu-rbac-root',    '查看用户',         'system:user:view',     'GET',    '/api/rbac/users/**',          'API', 'ANT', 10, 1, 'system'),
('res-user-add',        'menu-rbac-root',    '新增用户',         'system:user:add',      'POST',   '/api/rbac/users',             'API', 'EXACT', 0, 1, 'system'),
('res-user-edit',       'menu-rbac-root',    '编辑用户',         'system:user:edit',     'PUT',    '/api/rbac/users/{id}',        'API', 'ANT', 10, 1, 'system'),
('res-user-delete',     'menu-rbac-root',    '删除用户',         'system:user:delete',   'DELETE', '/api/rbac/users/{id}',        'API', 'ANT', 10, 1, 'system'),

-- === 管理后台 — 角色 ===
('res-role-view',       'menu-rbac-root',    '查看角色',         'system:role:view',     'GET',    '/api/rbac/roles/**',          'API', 'ANT', 10, 1, 'system'),
('res-role-add',        'menu-rbac-root',    '新增角色',         'system:role:add',      'POST',   '/api/rbac/roles',             'API', 'EXACT', 0, 1, 'system'),
('res-role-edit',       'menu-rbac-root',    '编辑角色',         'system:role:edit',     'PUT',    '/api/rbac/roles/{id}',        'API', 'ANT', 10, 1, 'system'),
('res-role-delete',     'menu-rbac-root',    '删除角色',         'system:role:delete',   'DELETE', '/api/rbac/roles/{id}',        'API', 'ANT', 10, 1, 'system'),
('res-role-grant',      'menu-rbac-root',    '角色授权',         'system:role:grant',    'POST',   '/api/rbac/roles/{roleId}/**', 'API', 'ANT', 10, 1, 'system'),

-- === 管理后台 — 菜单 ===
('res-menu-view',       'menu-rbac-root',    '查看菜单',         'system:menu:view',     'GET',    '/api/rbac/menus/**',          'API', 'ANT', 10, 1, 'system'),
('res-menu-add',        'menu-rbac-root',    '新增菜单',         'system:menu:add',      'POST',   '/api/rbac/menus',             'API', 'EXACT', 0, 1, 'system'),
('res-menu-edit',       'menu-rbac-root',    '编辑菜单',         'system:menu:edit',     'PUT',    '/api/rbac/menus/{id}',        'API', 'ANT', 10, 1, 'system'),
('res-menu-delete',     'menu-rbac-root',    '删除菜单',         'system:menu:delete',   'DELETE', '/api/rbac/menus/{id}',        'API', 'ANT', 10, 1, 'system'),

-- === 管理后台 — 资源 ===
('res-resource-view',   'menu-rbac-root',    '查看资源',         'system:resource:view', 'GET',    '/api/rbac/resources/**',      'API', 'ANT', 10, 1, 'system'),
('res-resource-add',    'menu-rbac-root',    '新增资源',         'system:resource:add',  'POST',   '/api/rbac/resources',         'API', 'EXACT', 0, 1, 'system'),
('res-resource-edit',   'menu-rbac-root',    '编辑资源',         'system:resource:edit', 'PUT',    '/api/rbac/resources/{id}',    'API', 'ANT', 10, 1, 'system'),
('res-resource-delete', 'menu-rbac-root',    '删除资源',         'system:resource:delete','DELETE', '/api/rbac/resources/{id}',    'API', 'ANT', 10, 1, 'system'),

-- === 管理后台 — Agent 管理 ===
('res-agent-manage',    'menu-rbac-root',    'Agent 管理列表',    'system:agent:manage',  'GET',    '/api/agents/all',             'API', 'EXACT', 0, 1, 'system'),
('res-agent-add',       'menu-rbac-root',    '新增 Agent',       'system:agent:add',     'POST',   '/api/agents',                 'API', 'EXACT', 0, 1, 'system'),
('res-agent-edit',      'menu-rbac-root',    '编辑 Agent',       'system:agent:edit',    'PUT',    '/api/agents/{id}',            'API', 'ANT', 10, 1, 'system'),
('res-agent-delete',    'menu-rbac-root',    '删除 Agent',       'system:agent:delete',  'DELETE', '/api/agents/{id}',            'API', 'ANT', 10, 1, 'system'),

-- === 管理后台 — 角色授权明细 ===
('res-role-menus',      'menu-rbac-root',    '查询角色菜单',     'system:role:menus',    'GET',    '/api/rbac/roles/{roleId}/menus',     'API', 'ANT', 10, 1, 'system'),
('res-role-resources',  'menu-rbac-root',    '查询角色资源',     'system:role:resources','GET',    '/api/rbac/roles/{roleId}/resources', 'API', 'ANT', 10, 1, 'system'),
('res-role-agents',     'menu-rbac-root',    '查询角色 Agent',   'system:role:agents',   'GET',    '/api/rbac/roles/{roleId}/agents',    'API', 'ANT', 10, 1, 'system'),

-- === 管理后台 — 用户角色查询 ===
('res-user-roles-view', 'menu-rbac-root',    '查询用户角色',     'system:user:roles',    'GET',    '/api/rbac/users/{userId}/roles',     'API', 'ANT', 10, 1, 'system'),

-- === 管理后台 — 审计日志 ===
('res-audit-view',      'menu-rbac-root',    '查看审计日志',     'system:audit:view',    'GET',    '/api/rbac/audit/access',        'API', 'EXACT', 0, 1, 'system'),

-- === 管理后台 — 模型供应商 ===
('res-model-provider-list', NULL,         '查看模型供应商',   'system:model-provider:view',   'GET',    '/api/rbac/model-providers',        'API', 'EXACT', 0, 1, 'system'),
('res-model-provider-add',  NULL,         '新增模型供应商',   'system:model-provider:add',    'POST',   '/api/rbac/model-providers',        'API', 'EXACT', 0, 1, 'system'),
('res-model-provider-edit', NULL,         '编辑模型供应商',   'system:model-provider:edit',   'PUT',    '/api/rbac/model-providers/{id}',   'API', 'ANT', 10, 1, 'system'),
('res-model-provider-delete', NULL,       '删除模型供应商',   'system:model-provider:delete', 'DELETE', '/api/rbac/model-providers/{id}',   'API', 'ANT', 10, 1, 'system'),

-- === 站内通知（归属消息中心菜单） ===
('res-notification-list',     'menu-message-center', '查看通知列表',   'notification:list',     'GET',    '/api/notifications',             'API', 'EXACT', 0, 1, 'system'),
('res-notification-count',    'menu-message-center', '未读通知数量',   'notification:count',    'GET',    '/api/notifications/unread-count', 'API', 'EXACT', 0, 1, 'system'),
('res-notification-read',     'menu-message-center', '标记通知已读',   'notification:read',     'PUT',    '/api/notifications/{id}/read',   'API', 'ANT', 10, 1, 'system'),
('res-notification-read-all', 'menu-message-center', '全部标记已读',   'notification:read-all', 'PUT',    '/api/notifications/read-all',    'API', 'EXACT', 0, 1, 'system'),
('res-notification-delete',   'menu-message-center', '删除通知',       'notification:delete',   'DELETE', '/api/notifications/{id}',         'API', 'ANT', 10, 1, 'system'),
('res-notification-send',     'menu-message-center', '发送通知',       'notification:send',     'POST',   '/api/notifications',             'API', 'EXACT', 0, 1, 'system'),

-- === 通知模板管理（管理员） ===
('res-notification-tpl-view',   'menu-rbac-root', '查看通知模板',   'notification:template:view',   'GET',    '/api/notifications/templates',       'API', 'EXACT', 0, 1, 'system'),
('res-notification-tpl-add',    'menu-rbac-root', '新增通知模板',   'notification:template:add',    'POST',   '/api/notifications/templates',       'API', 'EXACT', 0, 1, 'system'),
('res-notification-tpl-edit',   'menu-rbac-root', '编辑通知模板',   'notification:template:edit',   'PUT',    '/api/notifications/templates/{id}',  'API', 'ANT', 10, 1, 'system'),
('res-notification-tpl-delete', 'menu-rbac-root', '删除通知模板',   'notification:template:delete', 'DELETE', '/api/notifications/templates/{id}',  'API', 'ANT', 10, 1, 'system'),
('res-notification-stats',      'menu-rbac-root', '通知渠道统计',   'notification:stats:view',   'GET',    '/api/notifications/stats',           'API', 'EXACT', 0, 1, 'system'),

-- === 待办事项 ===
('res-todo-list',   'menu-workspace', '查看待办列表',   'todo:list',   'GET',    '/api/todos',         'API', 'EXACT', 0, 1, 'system'),
('res-todo-create', 'menu-workspace', '创建待办',       'todo:create', 'POST',   '/api/todos',         'API', 'EXACT', 0, 1, 'system'),
('res-todo-view',   'menu-workspace', '查看单条待办',   'todo:view',   'GET',    '/api/todos/{id}',    'API', 'ANT', 10, 1, 'system'),
('res-todo-edit',   'menu-workspace', '编辑待办',       'todo:edit',   'PUT',    '/api/todos/{id}',    'API', 'ANT', 10, 1, 'system'),
('res-todo-delete', 'menu-workspace', '删除待办',       'todo:delete', 'DELETE', '/api/todos/{id}',    'API', 'ANT', 10, 1, 'system'),

-- === Text2SQL 系统连接器（MySQL 等外部数据源） ===
('res-connector-list',     'menu-system-connector', '列出数据源连接',     'connector:datasource:list',       'GET',    '/api/text2sql/connectors',              'API', 'EXACT', 0, 1, 'system'),
('res-connector-detail',   'menu-system-connector', '查看数据源连接详情', 'connector:datasource:detail',     'GET',    '/api/text2sql/connectors/{id}',         'API', 'ANT', 10, 1, 'system'),
('res-connector-add',      'menu-system-connector', '新增数据源连接',     'connector:datasource:add',      'POST',   '/api/text2sql/connectors',              'API', 'EXACT', 0, 1, 'system'),
('res-connector-edit',     'menu-system-connector', '编辑数据源连接',     'connector:datasource:edit',     'PUT',    '/api/text2sql/connectors/{id}',         'API', 'ANT', 10, 1, 'system'),
('res-connector-delete',   'menu-system-connector', '删除数据源连接',     'connector:datasource:delete',   'DELETE', '/api/text2sql/connectors/{id}',         'API', 'ANT', 10, 1, 'system'),
('res-connector-test',     'menu-system-connector', '测试数据源连接参数', 'connector:datasource:test',       'POST',   '/api/text2sql/connectors/test',          'API', 'EXACT', 0, 1, 'system'),
('res-connector-test-id',  'menu-system-connector', '测试已保存连接',     'connector:datasource:test-saved', 'POST',   '/api/text2sql/connectors/{id}/test',   'API', 'ANT', 10, 1, 'system'),
('res-connector-metadata', 'menu-system-connector', '读取库表元数据',     'connector:datasource:metadata', 'GET',    '/api/text2sql/connectors/{id}/metadata', 'API', 'ANT', 10, 1, 'system'),
('res-connector-schema-refresh', 'menu-system-connector', '刷新数据源 Schema',   'connector:datasource:schema:refresh', 'POST', '/api/text2sql/connectors/{id}/schema/refresh', 'API', 'ANT', 10, 1, 'system'),
('res-connector-schema-view',    'menu-system-connector', '查看数据源 Schema 快照', 'connector:datasource:schema:view',    'GET',  '/api/text2sql/connectors/{id}/schema',         'API', 'ANT', 10, 1, 'system'),
('res-connector-index-build',  'menu-system-connector', '构建向量索引',       'connector:datasource:index:build',    'POST', '/api/text2sql/connectors/{id}/index/build',  'API', 'ANT', 10, 1, 'system'),
('res-connector-retrieve',     'menu-system-connector', '语义检索 Schema',     'connector:datasource:retrieve',       'POST', '/api/text2sql/connectors/{id}/retrieve',     'API', 'ANT', 10, 1, 'system')

ON CONFLICT (resource_code) DO UPDATE SET
    menu_id = EXCLUDED.menu_id,
    path = EXCLUDED.path,
    method = EXCLUDED.method,
    match_type = EXCLUDED.match_type,
    priority = EXCLUDED.priority;

-- ============================================================================
-- 7. Agent 注册
-- ============================================================================
INSERT INTO agent (id, status, agent_code, agent_name, description, permission_level, remark, create_by) VALUES
('cashflow',       1, 'cashflow',       '现金流预测', '基于TMS资金流水数据，生成13周滚动现金流预测报告',       1, '系统内置 · M1', 'system'),
('life-assistant', 1, 'life-assistant', '通用助手',   '处理日期时间、天气查询和个人待办等轻量任务',             1, '系统内置 · M1', 'system')
ON CONFLICT (agent_code) DO UPDATE SET
    agent_name = EXCLUDED.agent_name,
    description = EXCLUDED.description,
    permission_level = EXCLUDED.permission_level;

-- ============================================================================
-- 8. 超级管理员 — 拥有全部菜单
-- ============================================================================
INSERT INTO sys_role_menu (id, role_id, menu_id, create_by)
SELECT 'rm-admin-' || id, 'role-admin', id, 'system' FROM sys_menu
ON CONFLICT (role_id, menu_id) WHERE status <> 2 DO NOTHING;

-- ============================================================================
-- 9. 超级管理员 — 拥有全部资源权限
-- ============================================================================
INSERT INTO sys_role_resource (id, role_id, resource_id, create_by)
SELECT 'rr-admin-' || id, 'role-admin', id, 'system' FROM sys_resource
ON CONFLICT (role_id, resource_id) WHERE status <> 2 DO NOTHING;

-- ============================================================================
-- 10. 超级管理员 — 拥有全部 Agent 授权
-- ============================================================================
INSERT INTO sys_role_agent (id, role_id, agent_id, create_by)
SELECT 'ra-admin-' || id, 'role-admin', id, 'system' FROM agent
ON CONFLICT (role_id, agent_id) WHERE status <> 2 DO NOTHING;

-- ============================================================================
-- 11. 司库操作员 — 基础权限 (工作台 + Agent 对话)
-- ============================================================================

-- 菜单
INSERT INTO sys_role_menu (id, role_id, menu_id, create_by) VALUES
('rm-treasury-workspace', 'role-treasury', 'menu-workspace', 'system'),
('rm-treasury-rules',     'role-treasury', 'menu-rules-access', 'system'),
('rm-treasury-messages',  'role-treasury', 'menu-message-center', 'system'),
('rm-treasury-connector', 'role-treasury', 'menu-system-connector', 'system')
ON CONFLICT (role_id, menu_id) WHERE status <> 2 DO NOTHING;

-- 资源
INSERT INTO sys_role_resource (id, role_id, resource_id, create_by)
SELECT 'rr-treasury-' || id, 'role-treasury', id, 'system'
FROM sys_resource
WHERE resource_code IN (
    'auth:me:view',
    'system:menu:routes',
    'agent:ask',
    'agent:ask:stream',
    'agent:catalog:view',
    'system:agent:view',
    'notification:list',
    'notification:count',
    'notification:read',
    'notification:read-all',
    'notification:delete',
    'todo:list',
    'todo:create',
    'todo:view',
    'todo:edit',
    'todo:delete',
    'connector:datasource:list',
    'connector:datasource:detail',
    'connector:datasource:add',
    'connector:datasource:edit',
    'connector:datasource:delete',
    'connector:datasource:test',
    'connector:datasource:test-saved',
    'connector:datasource:metadata',
    'connector:datasource:schema:refresh',
    'connector:datasource:schema:view',
    'connector:datasource:index:build',
    'connector:datasource:retrieve'
)
ON CONFLICT (role_id, resource_id) WHERE status <> 2 DO NOTHING;

-- Agent
INSERT INTO sys_role_agent (id, role_id, agent_id, create_by) VALUES
('ra-treasury-cashflow', 'role-treasury', 'cashflow', 'system'),
('ra-treasury-life',     'role-treasury', 'life-assistant', 'system')
ON CONFLICT (role_id, agent_id) WHERE status <> 2 DO NOTHING;

-- ============================================================================
-- 12. 模型供应商 — DeepSeek 种子数据
-- ============================================================================
INSERT INTO sys_model_provider (id, provider_code, provider_name, base_url, api_key, models, default_model, is_enabled, sort_order, status, create_by) VALUES
('mp-deepseek', 'deepseek', 'DeepSeek', 'https://api.deepseek.com', '', '["deepseek-v4-flash","deepseek-v4-pro"]', 'deepseek-v4-flash', 1, 1, 1, 'system')
ON CONFLICT (provider_code) DO NOTHING;

-- ============================================================================
-- 13. 通知消息模板
-- ============================================================================
INSERT INTO agent_notification_template (id, template_code, title_template, content_template, variables, channel, status, create_by)
VALUES (
    'tmpl-todo-reminder',
    'todo.reminder',
    '待办提醒: {{todoTitle}}',
    '您的待办 **{{todoTitle}}** 将于 {{dueDate}} 到期，请及时处理。',
    '[{"name":"todoTitle","required":true,"description":"待办标题"},{"name":"dueDate","required":true,"description":"截止日期"}]',
    'IN_APP',
    1,
    'system'
) ON CONFLICT (template_code) DO NOTHING;

INSERT INTO agent_notification_template (id, template_code, title_template, content_template, variables, channel, status, create_by)
VALUES (
    'tmpl-todo-assigned',
    'todo.assigned',
    '新的待办: {{todoTitle}}',
    '{{assigner}} 给您分配了一个待办: **{{todoTitle}}**，请查看并处理。',
    '[{"name":"todoTitle","required":true,"description":"待办标题"},{"name":"assigner","required":true,"description":"分配人"}]',
    'IN_APP',
    1,
    'system'
) ON CONFLICT (template_code) DO NOTHING;

INSERT INTO agent_notification_template (id, template_code, title_template, content_template, variables, channel, status, create_by)
VALUES (
    'tmpl-agent-notify',
    'agent.notify',
    'Agent 通知: {{title}}',
    '{{content}}',
    '[{"name":"title","required":true,"description":"通知标题"},{"name":"content","required":true,"description":"通知内容"}]',
    'IN_APP',
    1,
    'system'
) ON CONFLICT (template_code) DO NOTHING;

-- ============================================================================
-- 002_seed.sql 完成
-- ============================================================================
