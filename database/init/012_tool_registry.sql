-- ============================================================================
-- 012 Tool 注册中心：表结构（可独立执行）+ 菜单/API + 五类示例数据
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys_tool_registry (
    id               text NOT NULL,
    tool_key         text NOT NULL,
    tool_name        text NOT NULL,
    category         text NOT NULL DEFAULT 'compute',
    description      text,
    runtime_kind     text NOT NULL DEFAULT 'GROOVY',
    script_content   text,
    input_schema     jsonb,
    output_schema    jsonb,
    connector        text NOT NULL DEFAULT 'sandbox_runtime',
    data_sensitivity text NOT NULL DEFAULT 'internal',
    side_effect      text NOT NULL DEFAULT 'none',
    permission_code  text NOT NULL DEFAULT 'LEVEL_1',
    version          text NOT NULL DEFAULT '1.0.0',
    owner            text,
    is_enabled       int4 NOT NULL DEFAULT 1,
    sort_order       int4 NOT NULL DEFAULT 0,
    status           int4 NOT NULL DEFAULT 1,
    remark           text,
    create_by        text,
    create_time      timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by        text,
    update_time      timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_tool_registry_pkey PRIMARY KEY (id),
    CONSTRAINT sys_tool_registry_tool_key_unique UNIQUE (tool_key)
);

COMMENT ON TABLE sys_tool_registry IS 'Tool 注册中心：脚本型与元数据型工具配置';
COMMENT ON COLUMN sys_tool_registry.id IS '主键 ID';
COMMENT ON COLUMN sys_tool_registry.tool_key IS 'Tool 唯一标识, Agent 调用时使用';
COMMENT ON COLUMN sys_tool_registry.tool_name IS 'Tool 展示名称';
COMMENT ON COLUMN sys_tool_registry.category IS '能力分类: data_query=数据查询, rule=规则判断, compute=计算处理, template=报告生成, notify=消息通知';
COMMENT ON COLUMN sys_tool_registry.description IS 'Tool 说明';
COMMENT ON COLUMN sys_tool_registry.runtime_kind IS '运行时: GROOVY=脚本沙箱, JAVA_BEAN=Spring 内置 Handler';
COMMENT ON COLUMN sys_tool_registry.script_content IS 'Groovy 脚本内容 (runtime_kind=GROOVY 时必填)';
COMMENT ON COLUMN sys_tool_registry.input_schema IS '入参 JSON Schema';
COMMENT ON COLUMN sys_tool_registry.output_schema IS '出参 JSON Schema';
COMMENT ON COLUMN sys_tool_registry.connector IS '连接方式/执行引擎标识';
COMMENT ON COLUMN sys_tool_registry.data_sensitivity IS '数据敏感度: public/internal/internal_finance/restricted';
COMMENT ON COLUMN sys_tool_registry.side_effect IS '副作用: none/notify/write';
COMMENT ON COLUMN sys_tool_registry.permission_code IS '所需权限码或 LEVEL_n';
COMMENT ON COLUMN sys_tool_registry.version IS '版本号';
COMMENT ON COLUMN sys_tool_registry.owner IS '负责人';
COMMENT ON COLUMN sys_tool_registry.is_enabled IS '是否启用: 0=禁用, 1=启用';
COMMENT ON COLUMN sys_tool_registry.sort_order IS '排序号';
COMMENT ON COLUMN sys_tool_registry.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_tool_registry.remark IS '备注';
COMMENT ON COLUMN sys_tool_registry.create_by IS '创建人';
COMMENT ON COLUMN sys_tool_registry.create_time IS '创建时间';
COMMENT ON COLUMN sys_tool_registry.update_by IS '更新人';
COMMENT ON COLUMN sys_tool_registry.update_time IS '更新时间';

INSERT INTO sys_menu (
    id, parent_id, menu_name, path, component, icon, sort_order, status, permission_code, remark, create_by, update_by
) VALUES (
    'menu-tool-registry', 'menu-rules-access', 'Tool 注册中心', '/tools', 'ToolsView', 'ToolOutlined', 25, 1,
    'system:tool:view', 'Tool 五类能力目录、Groovy 脚本沙箱', 'system', 'system'
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

INSERT INTO sys_resource (id, menu_id, resource_name, resource_code, method, path, resource_type, match_type, priority, status, create_by) VALUES
('res-tool-list',   'menu-tool-registry', '查看 Tool 注册', 'system:tool:view',   'GET',    '/api/rbac/tools',              'API', 'EXACT', 0,  1, 'system'),
('res-tool-add',    'menu-tool-registry', '新增 Tool',      'system:tool:add',    'POST',   '/api/rbac/tools',              'API', 'EXACT', 0,  1, 'system'),
('res-tool-edit',   'menu-tool-registry', '编辑 Tool',      'system:tool:edit',   'PUT',    '/api/rbac/tools/{id}',         'API', 'ANT',   10, 1, 'system'),
('res-tool-delete', 'menu-tool-registry', '删除 Tool',      'system:tool:delete', 'DELETE', '/api/rbac/tools/{id}',         'API', 'ANT',   10, 1, 'system'),
('res-tool-test',   'menu-tool-registry', '测试 Tool',      'system:tool:test',   'POST',   '/api/rbac/tools/{id}/test',    'API', 'ANT',   10, 1, 'system'),
('res-tool-reload', 'menu-tool-registry', '重载 Tool',      'system:tool:reload', 'POST',   '/api/rbac/tools/reload',       'API', 'EXACT', 0,  1, 'system'),
('res-tool-catalog','menu-tool-registry', '运行时目录',     'system:tool:catalog','GET',    '/api/tool/catalog',            'API', 'EXACT', 0,  1, 'system')
ON CONFLICT (id) DO UPDATE SET
    menu_id = EXCLUDED.menu_id,
    resource_name = EXCLUDED.resource_name,
    resource_code = EXCLUDED.resource_code,
    method = EXCLUDED.method,
    path = EXCLUDED.path,
    resource_type = EXCLUDED.resource_type,
    match_type = EXCLUDED.match_type,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    update_by = EXCLUDED.update_by,
    update_time = LOCALTIMESTAMP(6);

INSERT INTO sys_role_menu (id, role_id, menu_id, status, create_by)
VALUES ('rm-admin-tool-registry', 'role-admin', 'menu-tool-registry', 1, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sys_role_resource (id, role_id, resource_id, status, create_by)
SELECT 'rr-admin-' || r.id, 'role-admin', r.id, 1, 'system'
FROM sys_resource r
WHERE r.id IN (
    'res-tool-list', 'res-tool-add', 'res-tool-edit', 'res-tool-delete',
    'res-tool-test', 'res-tool-reload', 'res-tool-catalog'
)
ON CONFLICT (id) DO NOTHING;

-- 逻辑删除旧的多运行时沙箱记录
UPDATE sys_tool_registry SET status = 2, update_by = 'system', update_time = LOCALTIMESTAMP(6)
WHERE tool_key IN ('sandbox.groovy.eval', 'sandbox.javascript.eval', 'sandbox.spel.eval');

-- 五类能力 + 内置 Java Tool 元数据 + Groovy 示例脚本
INSERT INTO sys_tool_registry (
    id, tool_key, tool_name, category, description, runtime_kind, script_content,
    input_schema, output_schema, connector, data_sensitivity, side_effect,
    permission_code, version, owner, is_enabled, sort_order, status, create_by
) VALUES
-- 计算处理：统一 Groovy 沙箱（JAVA_BEAN）
(
    'tool-sandbox-script', 'sandbox.script.eval', 'Groovy 脚本沙箱',
    'compute', '平台唯一脚本运行时：数据后处理、规则与轻量计算（同 JVM，3s 超时）', 'JAVA_BEAN', NULL,
    '{"type":"object","properties":{"script":{"type":"string"},"bindings":{"type":"object"}},"required":["script"]}'::jsonb,
    '{"type":"object","properties":{"result":{}}}'::jsonb,
    'sandbox_runtime', 'internal', 'none', 'LEVEL_1', '1.0.0', 'platform', 1, 10, 1, 'system'
),
-- 数据查询
(
    'tool-query-map-groovy', 'query.transform.map_fields', '查询结果字段映射',
    'data_query', '将 bindings.rows 做字段重命名，用于通用查询后处理', 'GROOVY',
    $map_rows$def rows = bindings?.rows ?: []
return [count: rows.size(), rows: rows.collect { r ->
  [id: r.id, label: r.name ?: r.title, amount: r.amount]
}]$map_rows$,
    '{"type":"object","properties":{"bindings":{"type":"object","properties":{"rows":{"type":"array"}}}}}'::jsonb,
    '{"type":"object"}'::jsonb,
    'sandbox_runtime', 'internal', 'none', 'LEVEL_2', '1.0.0', 'platform', 1, 20, 1, 'system'
),
(
    'tool-builtin-ledger', 'ledger.fetch', '台账数据查询',
    'data_query', '拉取现金流/台账演示数据（Java 内置 Handler）', 'JAVA_BEAN', NULL,
    '{"type":"object"}'::jsonb,
    '{"type":"object"}'::jsonb,
    'tms_connector', 'internal_finance', 'none', 'LEVEL_2', '1.0.0', 'platform', 1, 21, 1, 'system'
),
(
    'tool-query-filter-groovy', 'query.filter.by_field', '查询结果列表过滤',
    'data_query', '按字段值过滤 bindings.items', 'GROOVY',
    $filter_items$def items = bindings?.items ?: []
def field = bindings?.field ?: "status"
def expect = bindings?.expect ?: "ok"
def out = items.findAll { String.valueOf(it[field]) == String.valueOf(expect) }
return [count: out.size(), items: out]$filter_items$,
    '{"type":"object","properties":{"bindings":{"type":"object"}}}'::jsonb,
    '{"type":"object"}'::jsonb,
    'sandbox_runtime', 'internal', 'none', 'LEVEL_2', '1.0.0', 'platform', 1, 22, 1, 'system'
),
-- 规则判断
(
    'tool-rule-threshold', 'rule.eval_amount_threshold', '金额阈值规则',
    'rule', '判断 bindings.amount 是否超过 bindings.threshold', 'GROOVY',
    $rule_threshold$def amount = (bindings?.amount ?: 0) as BigDecimal
def threshold = (bindings?.threshold ?: 0) as BigDecimal
return [passed: amount.abs() <= threshold, amount: amount, threshold: threshold]$rule_threshold$,
    '{"type":"object","properties":{"bindings":{"type":"object","properties":{"amount":{"type":"number"},"threshold":{"type":"number"}}}}}'::jsonb,
    '{"type":"object"}'::jsonb,
    'sandbox_runtime', 'internal_finance', 'none', 'LEVEL_2', '1.0.0', 'platform', 1, 30, 1, 'system'
),
-- 计算处理
(
    'tool-compute-sum', 'compute.aggregate_sum', '数值汇总',
    'compute', '对 bindings.values 数值列表求和', 'GROOVY',
    $compute_sum$def vals = bindings?.values ?: []
def sum = vals.collect { (it ?: 0) as BigDecimal }.sum()
return [count: vals.size(), sum: sum]$compute_sum$,
    '{"type":"object","properties":{"bindings":{"type":"object","properties":{"values":{"type":"array"}}}}}'::jsonb,
    '{"type":"object"}'::jsonb,
    'sandbox_runtime', 'internal', 'none', 'LEVEL_2', '1.0.0', 'platform', 1, 40, 1, 'system'
),
(
    'tool-builtin-time', 'system.time.now', '服务器时间',
    'compute', '查询当前日期时间（Java 内置）', 'JAVA_BEAN', NULL,
    '{"type":"object","properties":{"timezone":{"type":"string"}}}'::jsonb,
    '{"type":"object"}'::jsonb,
    'sandbox_runtime', 'public', 'none', 'LEVEL_1', '1.0.0', 'platform', 1, 41, 1, 'system'
),
-- 报告生成
(
    'tool-template-summary', 'template.render_text_summary', '文本摘要渲染',
    'template', '根据 bindings.title 与 bindings.bullets 生成 Markdown 摘要', 'GROOVY',
    $template_md$def title = bindings?.title ?: "摘要"
def bullets = bindings?.bullets ?: []
def body = bullets.collect { "- ${it}" }.join("\n")
return [markdown: "# ${title}\n\n${body}"]$template_md$,
    '{"type":"object","properties":{"bindings":{"type":"object"}}}'::jsonb,
    '{"type":"object","properties":{"markdown":{"type":"string"}}}'::jsonb,
    'template_engine', 'internal', 'none', 'LEVEL_2', '1.0.0', 'platform', 1, 50, 1, 'system'
),
-- 消息通知
(
    'tool-notify-format', 'notify.format_message', '通知文案格式化',
    'notify', '将 bindings.recipient 与 bindings.body 格式化为待发通知载荷', 'GROOVY',
    'return [channel: bindings?.channel ?: "in_app", recipient: bindings?.recipient, subject: bindings?.subject ?: "系统通知", body: bindings?.body ?: ""]',
    '{"type":"object","properties":{"bindings":{"type":"object"}}}'::jsonb,
    '{"type":"object"}'::jsonb,
    'wecom_bot', 'internal', 'notify', 'LEVEL_2', '1.0.0', 'platform', 1, 60, 1, 'system'
),
(
    'tool-builtin-todo-create', 'todo.create', '创建待办',
    'notify', '创建用户待办（Java 内置，具写入副作用）', 'JAVA_BEAN', NULL,
    '{"type":"object"}'::jsonb,
    '{"type":"object"}'::jsonb,
    'agent_platform', 'internal', 'write', 'LEVEL_2', '1.0.0', 'platform', 1, 61, 1, 'system'
)
ON CONFLICT (tool_key) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    runtime_kind = EXCLUDED.runtime_kind,
    script_content = EXCLUDED.script_content,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    connector = EXCLUDED.connector,
    data_sensitivity = EXCLUDED.data_sensitivity,
    side_effect = EXCLUDED.side_effect,
    permission_code = EXCLUDED.permission_code,
    version = EXCLUDED.version,
    owner = EXCLUDED.owner,
    is_enabled = EXCLUDED.is_enabled,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    update_by = EXCLUDED.update_by,
    update_time = LOCALTIMESTAMP(6);

-- 下线旧多运行时与已替换的 Tool Key
UPDATE sys_tool_registry
SET status = 2, update_by = 'system', update_time = LOCALTIMESTAMP(6)
WHERE (
    runtime_kind IN ('JAVASCRIPT', 'SPEL')
    OR tool_key IN ('query.filter.by_expression', 'sandbox.groovy.eval', 'sandbox.javascript.eval', 'sandbox.spel.eval')
) AND status <> 2;

-- 修正历史种子中字面量 \n 的 Groovy 脚本（与上方 INSERT 内容一致）
UPDATE sys_tool_registry SET script_content = $map_rows$def rows = bindings?.rows ?: []
return [count: rows.size(), rows: rows.collect { r ->
  [id: r.id, label: r.name ?: r.title, amount: r.amount]
}]$map_rows$, update_time = LOCALTIMESTAMP(6)
WHERE tool_key = 'query.transform.map_fields';

UPDATE sys_tool_registry SET script_content = $filter_items$def items = bindings?.items ?: []
def field = bindings?.field ?: "status"
def expect = bindings?.expect ?: "ok"
def out = items.findAll { String.valueOf(it[field]) == String.valueOf(expect) }
return [count: out.size(), items: out]$filter_items$, update_time = LOCALTIMESTAMP(6)
WHERE tool_key = 'query.filter.by_field';

UPDATE sys_tool_registry SET script_content = $rule_threshold$def amount = (bindings?.amount ?: 0) as BigDecimal
def threshold = (bindings?.threshold ?: 0) as BigDecimal
return [passed: amount.abs() <= threshold, amount: amount, threshold: threshold]$rule_threshold$, update_time = LOCALTIMESTAMP(6)
WHERE tool_key = 'rule.eval_amount_threshold';

UPDATE sys_tool_registry SET script_content = $compute_sum$def vals = bindings?.values ?: []
def sum = vals.collect { (it ?: 0) as BigDecimal }.sum()
return [count: vals.size(), sum: sum]$compute_sum$, update_time = LOCALTIMESTAMP(6)
WHERE tool_key = 'compute.aggregate_sum';

UPDATE sys_tool_registry SET script_content = $template_md$def title = bindings?.title ?: "摘要"
def bullets = bindings?.bullets ?: []
def body = bullets.collect { "- ${it}" }.join("\n")
return [markdown: "# ${title}\n\n${body}"]$template_md$, update_time = LOCALTIMESTAMP(6)
WHERE tool_key = 'template.render_text_summary';
