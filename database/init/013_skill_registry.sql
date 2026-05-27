-- ============================================================================
-- 13.x Skill 注册中心
-- 方案文档: docs/Skill平台技术落地方案.md 附录 B
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
COMMENT ON COLUMN sys_skill.policy_json IS '执行策略 execution_policy，见 docs/Skill平台技术落地方案.md 附录 A';
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

CREATE TABLE IF NOT EXISTS sys_skill_embedding (
    id                  text NOT NULL,
    skill_id            text NOT NULL,
    embedding_model     text NOT NULL,
    embedding_vector    vector(1024),
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
