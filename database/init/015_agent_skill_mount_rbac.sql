-- ============================================================================
-- 015 Agent Skill 挂载 API RBAC
-- 依赖: 002_seed.sql, 013_skill_registry.sql
-- ============================================================================

INSERT INTO sys_resource (id, menu_id, resource_name, resource_code, method, path, resource_type, match_type, priority, status, create_by) VALUES
('res-agent-skill-view', 'menu-rbac-root', '查看 Agent Skill 挂载', 'system:agent:skill:view', 'GET', '/api/agents/{id}/skills', 'API', 'ANT', 10, 1, 'system'),
('res-agent-skill-edit', 'menu-rbac-root', '编辑 Agent Skill 挂载', 'system:agent:skill:edit', 'PUT', '/api/agents/{id}/skills', 'API', 'ANT', 10, 1, 'system')
ON CONFLICT (id) DO UPDATE SET
    menu_id = EXCLUDED.menu_id,
    resource_name = EXCLUDED.resource_name,
    resource_code = EXCLUDED.resource_code,
    method = EXCLUDED.method,
    path = EXCLUDED.path,
    match_type = EXCLUDED.match_type,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    update_by = EXCLUDED.update_by,
    update_time = LOCALTIMESTAMP(6);

INSERT INTO sys_role_resource (id, role_id, resource_id, status, create_by)
SELECT 'rr-admin-' || r.id, 'role-admin', r.id, 1, 'system'
FROM sys_resource r
WHERE r.id IN ('res-agent-skill-view', 'res-agent-skill-edit')
ON CONFLICT (id) DO NOTHING;
