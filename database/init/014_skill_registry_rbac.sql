-- ============================================================================
-- 014 Skill 注册中心：RBAC + 示例 Skill
-- 依赖: 013_skill_registry.sql
-- 说明: resource_code 全局唯一，读接口合并为一条 ANT 规则
-- ============================================================================

INSERT INTO sys_menu (
    id, parent_id, menu_name, path, component, icon, sort_order, status, permission_code, remark, create_by, update_by
) VALUES (
    'menu-skill-registry', 'menu-rules-access', 'Skill 管理', '/skills', 'SkillsView', 'Brain', 26, 1,
    'system:skill:view', 'Agent Skills 指令包注册与发布', 'system', 'system'
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

-- 清理旧版 014 可能插入的重复/废弃资源行
DELETE FROM sys_role_resource
WHERE resource_id IN (
    'res-skill-list', 'res-skill-catalog', 'res-skill-detail', 'res-skill-export',
    'res-skill-test-route', 'res-skill-reload'
);

DELETE FROM sys_resource
WHERE id IN (
    'res-skill-list', 'res-skill-catalog', 'res-skill-detail', 'res-skill-export',
    'res-skill-test-route', 'res-skill-reload'
);

INSERT INTO sys_resource (id, menu_id, resource_name, resource_code, method, path, resource_type, match_type, priority, status, create_by) VALUES
('res-skill-view',        'menu-skill-registry', '查看 Skill',       'system:skill:view',        'GET',    '/api/skills/**',               'API', 'ANT',   10, 1, 'system'),
('res-skill-add',         'menu-skill-registry', '新增 Skill',       'system:skill:add',         'POST',   '/api/skills',                  'API', 'EXACT', 0,  1, 'system'),
('res-skill-edit',        'menu-skill-registry', '编辑 Skill',       'system:skill:edit',        'PUT',    '/api/skills/{id}',             'API', 'ANT',   10, 1, 'system'),
('res-skill-delete',      'menu-skill-registry', '删除 Skill',       'system:skill:delete',      'DELETE', '/api/skills/{id}',             'API', 'ANT',   10, 1, 'system'),
('res-skill-publish',     'menu-skill-registry', '发布 Skill',       'system:skill:publish',     'POST',   '/api/skills/{id}/publish',     'API', 'ANT',   10, 1, 'system'),
('res-skill-import',      'menu-skill-registry', '导入 Skill',       'system:skill:import',      'POST',   '/api/skills/import',           'API', 'EXACT', 0,  1, 'system'),
('res-skill-test-route',  'menu-skill-registry', 'Skill 路由仿真',   'system:skill:test-route',  'POST',   '/api/skills/test-route',       'API', 'EXACT', 0,  1, 'system'),
('res-skill-reload',      'menu-skill-registry', '重载 Skill',       'system:skill:reload',      'POST',   '/api/skills/reload',           'API', 'EXACT', 0,  1, 'system')
ON CONFLICT (resource_code) DO UPDATE SET
    menu_id = EXCLUDED.menu_id,
    resource_name = EXCLUDED.resource_name,
    method = EXCLUDED.method,
    path = EXCLUDED.path,
    resource_type = EXCLUDED.resource_type,
    match_type = EXCLUDED.match_type,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    update_by = EXCLUDED.update_by,
    update_time = LOCALTIMESTAMP(6);

INSERT INTO sys_role_menu (id, role_id, menu_id, status, create_by)
VALUES ('rm-admin-skill-registry', 'role-admin', 'menu-skill-registry', 1, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sys_role_resource (id, role_id, resource_id, status, create_by)
SELECT 'rr-admin-' || r.id, 'role-admin', r.id, 1, 'system'
FROM sys_resource r
WHERE r.resource_code IN (
    'system:skill:view',
    'system:skill:add',
    'system:skill:edit',
    'system:skill:delete',
    'system:skill:publish',
    'system:skill:import',
    'system:skill:test-route',
    'system:skill:reload'
)
ON CONFLICT (id) DO NOTHING;
