-- ============================================================================
-- 016 Document Skills P4: document Agent + Tool 注册 + 挂载
-- 依赖: 013_skill_registry.sql, 012_tool_registry.sql, 002_seed.sql
-- Skill 正文与 scripts 由 DocumentSkillBootstrap 从 classpath 引导
-- ============================================================================

INSERT INTO agent (id, status, agent_code, agent_name, description, permission_level, remark, create_by) VALUES
('document', 1, 'document', '文档处理', '处理 Word/PDF/PPT/Excel 文档的读取、编辑、转换与校验', 2, '系统内置 · Document Skills P4', 'system')
ON CONFLICT (agent_code) DO UPDATE SET
    agent_name = EXCLUDED.agent_name,
    description = EXCLUDED.description,
    permission_level = EXCLUDED.permission_level,
    update_time = LOCALTIMESTAMP(6);

INSERT INTO sys_role_agent (id, role_id, agent_id, status, create_by)
VALUES ('ra-admin-document', 'role-admin', 'document', 1, 'system')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sys_tool_registry (
    id, tool_key, tool_name, category, description, runtime_kind, connector,
    data_sensitivity, side_effect, permission_code, is_enabled, sort_order, status, create_by
) VALUES
('tool-doc-unpack', 'document.office.unpack', 'Office 解压', 'compute',
 '解压 docx/pptx/xlsx 到目录', 'CLI', 'cli_process_runner', 'internal', 'write', 'LEVEL_2', 1, 110, 1, 'system'),
('tool-doc-pack', 'document.office.pack', 'Office 打包', 'compute',
 '将目录打包为 Office 文档', 'CLI', 'cli_process_runner', 'internal', 'write', 'LEVEL_2', 1, 111, 1, 'system'),
('tool-doc-validate', 'document.office.validate', 'Office 校验', 'rule',
 '校验 Office 文档结构', 'CLI', 'cli_process_runner', 'internal', 'none', 'LEVEL_1', 1, 112, 1, 'system'),
('tool-doc-recalc', 'document.xlsx.recalc', 'Excel 重算', 'compute',
 '重算 xlsx 公式', 'CLI', 'cli_process_runner', 'internal', 'write', 'LEVEL_2', 1, 113, 1, 'system'),
('tool-doc-extract', 'document.extract-text', '文档提取文本', 'data_query',
 '从 docx/pdf 提取纯文本', 'CLI', 'cli_process_runner', 'internal', 'none', 'LEVEL_1', 1, 114, 1, 'system'),
('tool-doc-pandoc', 'document.pandoc.convert', 'Pandoc 转换', 'template',
 'pandoc 文档格式转换', 'CLI', 'cli_process_runner', 'internal', 'write', 'LEVEL_2', 1, 115, 1, 'system'),
('tool-doc-pdf-img', 'document.pdf.to-images', 'PDF 转图片', 'template',
 'pdftoppm 渲染 PDF 页面', 'CLI', 'cli_process_runner', 'internal', 'write', 'LEVEL_2', 1, 116, 1, 'system')
ON CONFLICT (tool_key) DO UPDATE SET
    tool_name = EXCLUDED.tool_name,
    description = EXCLUDED.description,
    runtime_kind = EXCLUDED.runtime_kind,
    side_effect = EXCLUDED.side_effect,
    update_by = EXCLUDED.update_by,
    update_time = LOCALTIMESTAMP(6);

-- agent_skill 挂载: 引导完成后按 skill_code 关联
INSERT INTO agent_skill (id, agent_id, skill_id, is_default, sort_order, status, create_by)
SELECT 'asm-document-' || s.skill_code, 'document', s.id,
       CASE WHEN s.skill_code = 'docx' THEN 1 ELSE 0 END,
       CASE s.skill_code
           WHEN 'docx' THEN 10
           WHEN 'pdf' THEN 20
           WHEN 'pptx' THEN 30
           WHEN 'xlsx' THEN 40
           ELSE 50
       END,
       1, 'system'
FROM sys_skill s
WHERE s.skill_code IN ('docx', 'pdf', 'pptx', 'xlsx')
  AND s.status <> 2
ON CONFLICT (agent_id, skill_id) DO UPDATE SET
    is_default = EXCLUDED.is_default,
    sort_order = EXCLUDED.sort_order,
    update_time = LOCALTIMESTAMP(6);
