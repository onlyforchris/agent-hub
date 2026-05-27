-- ============================================================================
-- 011 模型配置与运行监控：菜单、API 资源、演示数据
-- ============================================================================

-- 菜单：规则与接入 → 模型配置与监控
INSERT INTO sys_menu (
    id, parent_id, menu_name, path, component, icon, sort_order, status, permission_code, remark, create_by, update_by
) VALUES (
    'menu-model-monitor', 'menu-rules-access', '模型配置与监控', '/models', 'ModelsView', 'CpuOutlined', 30, 1,
    'system:model-monitor:view', '大模型供应商 CRUD、连接测试、Token/API/会话监控', 'system', 'system'
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

-- 清理上次执行失败时可能留下的重复 resource_code 行（011 初版误用同一 permission_code 多条插入）
DELETE FROM sys_role_resource
WHERE resource_id IN (
    'res-model-monitor-summary',
    'res-model-monitor-llm-calls',
    'res-model-monitor-conversations',
    'res-model-monitor-traces',
    'res-model-monitor-conversation-detail'
);
DELETE FROM sys_resource
WHERE id IN (
    'res-model-monitor-summary',
    'res-model-monitor-llm-calls',
    'res-model-monitor-conversations',
    'res-model-monitor-traces',
    'res-model-monitor-conversation-detail'
);

-- API 资源（resource_code 全局唯一：监控类接口合并为一条 ANT 规则）
INSERT INTO sys_resource (id, menu_id, resource_name, resource_code, method, path, resource_type, match_type, priority, status, create_by) VALUES
('res-model-provider-test', 'menu-model-monitor', '测试模型连接', 'system:model-provider:test', 'POST', '/api/rbac/model-providers/{id}/test', 'API', 'ANT', 10, 1, 'system'),
('res-model-monitor-api',   'menu-model-monitor', '模型运行监控',   'system:model-monitor:view',   'GET',    '/api/rbac/model-monitor/**',       'API', 'ANT', 10, 1, 'system')
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

-- 管理员角色授权
INSERT INTO sys_role_menu (id, role_id, menu_id, status, create_by)
VALUES ('rm-admin-model-monitor', 'role-admin', 'menu-model-monitor', 1, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sys_role_resource (id, role_id, resource_id, status, create_by)
SELECT 'rr-admin-' || r.id, 'role-admin', r.id, 1, 'system'
FROM sys_resource r
WHERE r.id IN (
    'res-model-provider-test',
    'res-model-monitor-api'
)
ON CONFLICT (id) DO NOTHING;

-- 演示：LLM 调用审计（近 7 天）
INSERT INTO audit_log (
    id, trace_id, session_id, user_id, agent_id, action_type, action, target,
    model_provider, model_name, input_tokens, output_tokens,
    start_time, end_time, duration_ms, status, payload, create_by
) VALUES
(
    'audit-llm-demo-001', 'trace-demo-001', 'sess-demo-001', 'user-admin', 'cashflow',
    'LLM_CALL', 'deepseek.chat', 'deepseek-v4-flash', 'deepseek', 'deepseek-v4-flash',
    1280, 420, LOCALTIMESTAMP(6) - INTERVAL '2 hours', LOCALTIMESTAMP(6) - INTERVAL '2 hours' + INTERVAL '3 seconds',
    2840, 1, '{"promptKey":"cashflow-forecast-briefing"}'::jsonb, 'system'
),
(
    'audit-llm-demo-002', 'trace-demo-002', 'sess-demo-002', 'user-admin', 'life-assistant',
    'LLM_CALL', 'deepseek.chat', 'deepseek-v4-flash', 'deepseek', 'deepseek-v4-flash',
    890, 310, LOCALTIMESTAMP(6) - INTERVAL '5 hours', LOCALTIMESTAMP(6) - INTERVAL '5 hours' + INTERVAL '2 seconds',
    1920, 1, '{"promptKey":"life.chat"}'::jsonb, 'system'
),
(
    'audit-llm-demo-003', 'trace-demo-003', 'sess-demo-003', 'user-finance', 'text2sql',
    'LLM_CALL', 'deepseek.chat', 'deepseek-v4-pro', 'deepseek', 'deepseek-v4-pro',
    2100, 680, LOCALTIMESTAMP(6) - INTERVAL '1 day', LOCALTIMESTAMP(6) - INTERVAL '1 day' + INTERVAL '4 seconds',
    4100, 1, '{"promptKey":"text2sql.generate"}'::jsonb, 'system'
),
(
    'audit-llm-demo-004', 'trace-demo-004', 'sess-demo-004', 'user-finance', 'cashflow',
    'LLM_CALL', 'deepseek.chat', 'deepseek-v4-flash', 'deepseek', 'deepseek-v4-flash',
    450, 0, LOCALTIMESTAMP(6) - INTERVAL '3 hours', LOCALTIMESTAMP(6) - INTERVAL '3 hours' + INTERVAL '1 seconds',
    980, 0, '{"error":"rate limit"}'::jsonb, 'system'
)
ON CONFLICT (id) DO NOTHING;

-- 演示：历史对话轮次
INSERT INTO conversation_record (
    id, session_id, turn_id, user_id, agent_id, user_input, agent_reply, summary, status, create_by
) VALUES
(
    'conv-demo-001', 'sess-demo-001', 'turn-001', 'user-admin', 'cashflow',
    '帮我预测未来 13 周现金流', '已生成 13 周滚动预测，最低余额出现在第 9 周。',
    '现金流预测请求', 1, 'system'
),
(
    'conv-demo-002', 'sess-demo-001', 'turn-002', 'user-admin', 'cashflow',
    '第 9 周为什么最低？', '主要因应付账款集中到期与季节性回款放缓叠加。',
    '追问预测低点原因', 1, 'system'
),
(
    'conv-demo-003', 'sess-demo-002', 'turn-001', 'user-admin', 'life-assistant',
    '明天北京天气怎么样？', '北京明天晴，15~22℃，适合户外活动。',
    '天气查询', 1, 'system'
)
ON CONFLICT (id) DO NOTHING;

-- 演示：执行 Trace
INSERT INTO execution_trace (
    id, trace_id, user_id, session_id, agent_id, intent_action, input_summary, turn_id,
    llm_model, llm_tokens, tool_calls, duration_ms, outputs, status, started_at, completed_at, create_by
) VALUES
(
    'etrace-demo-001', 'trace-demo-001', 'user-admin', 'sess-demo-001', 'cashflow', 'forecast',
    '帮我预测未来 13 周现金流', 'turn-001', 'deepseek-v4-flash', 1700, 2, 5200,
    '{"summary":"13周预测完成"}'::jsonb, 1,
    LOCALTIMESTAMP(6) - INTERVAL '2 hours', LOCALTIMESTAMP(6) - INTERVAL '2 hours' + INTERVAL '5 seconds', 'system'
),
(
    'etrace-demo-002', 'trace-demo-004', 'user-finance', 'sess-demo-004', 'cashflow', 'chat',
    '导出上周报表', 'turn-001', 'deepseek-v4-flash', 450, 0, 980,
    '{}'::jsonb, 0,
    LOCALTIMESTAMP(6) - INTERVAL '3 hours', LOCALTIMESTAMP(6) - INTERVAL '3 hours' + INTERVAL '1 seconds', 'system'
)
ON CONFLICT (id) DO NOTHING;
