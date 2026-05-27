-- ============================================================================
-- 001_schema.sql — Agent 中台 v2.0 全量表结构（整理版）
--
-- 架构: AgentBase + Java 代码直写, 无 YAML DSL
-- 规范: 全表 timestamp(6) + LOCALTIMESTAMP(6), 全字段 COMMENT ON
-- 不可变表: execution_trace / execution_step / audit_log / sys_audit_access /
--           sys_audit_access_detail / conversation_record
-- 业务表: 其余均为逻辑删除（status: 0=暂存,1=正常,2=删除）
-- ============================================================================

-- ============================================================================
-- 1. Agent 配置表
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent (
    id              text NOT NULL,
    agent_code      text NOT NULL,
    agent_name      text NOT NULL,
    description     text,
    permission_level int4 NOT NULL DEFAULT 1,
    icon            text,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT agent_pkey PRIMARY KEY (id),
    CONSTRAINT agent_code_unique UNIQUE (agent_code)
);

COMMENT ON TABLE agent IS 'Agent 配置表';
COMMENT ON COLUMN agent.id IS '主键 ID';
COMMENT ON COLUMN agent.agent_code IS 'Agent 编码, 全局唯一, 对应 AgentInfo.id()';
COMMENT ON COLUMN agent.agent_name IS 'Agent 名称';
COMMENT ON COLUMN agent.description IS 'Agent 职责描述';
COMMENT ON COLUMN agent.permission_level IS '所需最低权限级别 (1-5)';
COMMENT ON COLUMN agent.icon IS '展示图标';
COMMENT ON COLUMN agent.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN agent.remark IS '备注';
COMMENT ON COLUMN agent.create_by IS '创建人';
COMMENT ON COLUMN agent.create_time IS '创建时间';
COMMENT ON COLUMN agent.update_by IS '更新人';
COMMENT ON COLUMN agent.update_time IS '更新时间';

-- ============================================================================
-- 2. 执行 Trace 主表 (不可变, 只 INSERT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_trace (
    id              text NOT NULL,
    trace_id        text NOT NULL,
    user_id         text,
    session_id      text,
    agent_id        text,
    intent_action   text,
    input_summary   text,
    turn_id         text,
    llm_model       text,
    llm_tokens      int4,
    tool_calls      int4 NOT NULL DEFAULT 0,
    duration_ms     int8,
    outputs         jsonb NOT NULL DEFAULT '{}'::jsonb,
    client_actions  jsonb NOT NULL DEFAULT '[]'::jsonb,
    error_message   text,
    started_at      timestamp(6),
    completed_at    timestamp(6),
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT execution_trace_pkey PRIMARY KEY (id),
    CONSTRAINT execution_trace_trace_id_unique UNIQUE (trace_id)
);

COMMENT ON TABLE execution_trace IS 'Agent 执行 Trace 主表 (不可变表, 只追加)';
COMMENT ON COLUMN execution_trace.id IS '主键 ID';
COMMENT ON COLUMN execution_trace.trace_id IS '链路唯一 Trace ID';
COMMENT ON COLUMN execution_trace.user_id IS '发起用户 ID';
COMMENT ON COLUMN execution_trace.session_id IS '会话 ID';
COMMENT ON COLUMN execution_trace.agent_id IS '执行 Agent ID';
COMMENT ON COLUMN execution_trace.intent_action IS 'Intent.action(), 如 forecast / explain / export';
COMMENT ON COLUMN execution_trace.input_summary IS '用户输入摘要';
COMMENT ON COLUMN execution_trace.turn_id IS '轮次 ID';
COMMENT ON COLUMN execution_trace.llm_model IS '使用的模型标识';
COMMENT ON COLUMN execution_trace.llm_tokens IS 'LLM token 消耗 (input + output)';
COMMENT ON COLUMN execution_trace.tool_calls IS '工具调用次数';
COMMENT ON COLUMN execution_trace.duration_ms IS '执行耗时 (毫秒)';
COMMENT ON COLUMN execution_trace.outputs IS '最终输出 JSON';
COMMENT ON COLUMN execution_trace.client_actions IS '前端动作列表 JSON';
COMMENT ON COLUMN execution_trace.error_message IS '执行异常时的错误信息';
COMMENT ON COLUMN execution_trace.started_at IS '执行开始时间';
COMMENT ON COLUMN execution_trace.completed_at IS '执行结束时间';
COMMENT ON COLUMN execution_trace.status IS '执行状态: 0=失败, 1=成功';
COMMENT ON COLUMN execution_trace.remark IS '备注';
COMMENT ON COLUMN execution_trace.create_by IS '创建人';
COMMENT ON COLUMN execution_trace.create_time IS '创建时间';
COMMENT ON COLUMN execution_trace.update_by IS '审计表无更新, 始终为空';
COMMENT ON COLUMN execution_trace.update_time IS '审计表无更新, 始终为默认值';

-- ============================================================================
-- 3. 执行 Step 明细表 (不可变, 只 INSERT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_step (
    id              text NOT NULL,
    trace_id        text NOT NULL,
    step_id         text NOT NULL,
    step_type       text NOT NULL,
    step_status     text NOT NULL,
    duration_ms     int8 NOT NULL DEFAULT 0,
    input_summary   jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_summary  jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_code      text,
    error_message   text,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT execution_step_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE execution_step IS 'Agent 执行 Step 明细表 (不可变表, 只追加)';
COMMENT ON COLUMN execution_step.id IS '主键 ID';
COMMENT ON COLUMN execution_step.trace_id IS '关联的 Trace ID';
COMMENT ON COLUMN execution_step.step_id IS '步骤标识';
COMMENT ON COLUMN execution_step.step_type IS '步骤类型: tool / llm';
COMMENT ON COLUMN execution_step.step_status IS '步骤状态: running / ok / aborted';
COMMENT ON COLUMN execution_step.duration_ms IS '执行耗时 (毫秒)';
COMMENT ON COLUMN execution_step.input_summary IS '输入摘要 JSON';
COMMENT ON COLUMN execution_step.output_summary IS '输出摘要 JSON';
COMMENT ON COLUMN execution_step.error_code IS '失败错误码';
COMMENT ON COLUMN execution_step.error_message IS '失败错误信息';
COMMENT ON COLUMN execution_step.status IS '步骤状态: 0=失败, 1=成功';
COMMENT ON COLUMN execution_step.remark IS '备注';
COMMENT ON COLUMN execution_step.create_by IS '创建人';
COMMENT ON COLUMN execution_step.create_time IS '创建时间';
COMMENT ON COLUMN execution_step.update_by IS '审计表无更新, 始终为空';
COMMENT ON COLUMN execution_step.update_time IS '审计表无更新, 始终为默认值';

-- ============================================================================
-- 4. 审计日志表 (不可变, 只 INSERT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              text NOT NULL,
    trace_id        text,
    session_id      text,
    user_id         text,
    agent_id        text,
    action_type     text NOT NULL,
    action          text NOT NULL,
    target          text,
    model_provider  text,
    model_name      text,
    input_tokens    int4,
    output_tokens   int4,
    start_time      timestamp(6),
    end_time        timestamp(6),
    duration_ms     int4,
    status          int4 NOT NULL DEFAULT 1,
    error_code      text,
    error_message   text,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE audit_log IS '审计日志表 (不可变表, 只追加)';
COMMENT ON COLUMN audit_log.id IS '主键 ID';
COMMENT ON COLUMN audit_log.trace_id IS '关联的 Trace ID';
COMMENT ON COLUMN audit_log.session_id IS '关联的会话 ID';
COMMENT ON COLUMN audit_log.user_id IS '操作用户 ID';
COMMENT ON COLUMN audit_log.agent_id IS '关联的 Agent ID';
COMMENT ON COLUMN audit_log.action_type IS '动作类型: LLM_CALL, TOOL_CALL, AGENT_EXEC, USER_CONFIRM, PERM_CHECK, EXPORT, LOGIN';
COMMENT ON COLUMN audit_log.action IS '具体动作编码, 如 cashflow.forecast, ledger.fetch, deepseek.chat';
COMMENT ON COLUMN audit_log.target IS '操作目标: 工具 key / 模型名 / 资源路径';
COMMENT ON COLUMN audit_log.model_provider IS '模型供应商: deepseek / openai / mock';
COMMENT ON COLUMN audit_log.model_name IS '模型名称: deepseek-v4 / deepseek-v3';
COMMENT ON COLUMN audit_log.input_tokens IS '输入 Token 数 (LLM 调用时)';
COMMENT ON COLUMN audit_log.output_tokens IS '输出 Token 数 (LLM 调用时)';
COMMENT ON COLUMN audit_log.start_time IS '操作开始时间';
COMMENT ON COLUMN audit_log.end_time IS '操作结束时间';
COMMENT ON COLUMN audit_log.duration_ms IS '操作耗时 (毫秒)';
COMMENT ON COLUMN audit_log.status IS '状态: 1=成功, 0=失败';
COMMENT ON COLUMN audit_log.error_code IS '错误码 (失败时)';
COMMENT ON COLUMN audit_log.error_message IS '错误信息 (失败时)';
COMMENT ON COLUMN audit_log.payload IS '完整载荷 JSON (请求/响应摘要)';
COMMENT ON COLUMN audit_log.remark IS '备注';
COMMENT ON COLUMN audit_log.create_by IS '创建人';
COMMENT ON COLUMN audit_log.create_time IS '创建时间';
COMMENT ON COLUMN audit_log.update_by IS '审计表无更新, 始终为空';
COMMENT ON COLUMN audit_log.update_time IS '审计表无更新, 始终为默认值';

CREATE INDEX IF NOT EXISTS idx_audit_log_trace    ON audit_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_session  ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user     ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_agent    ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_type     ON audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_time     ON audit_log(create_time);

-- ============================================================================
-- 5. RBAC — 组织架构
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_department (
    id              text NOT NULL,
    parent_id       text NOT NULL DEFAULT '0',
    dept_code       text NOT NULL,
    dept_name       text NOT NULL,
    sort_order      int4 NOT NULL DEFAULT 0,
    leader          text,
    phone           text,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_department_pkey PRIMARY KEY (id),
    CONSTRAINT sys_department_code_unique UNIQUE (dept_code)
);

COMMENT ON TABLE sys_department IS '组织架构表';
COMMENT ON COLUMN sys_department.id IS '主键 ID';
COMMENT ON COLUMN sys_department.parent_id IS '父组织 ID, 根节点为 0';
COMMENT ON COLUMN sys_department.dept_code IS '组织编码, 全局唯一';
COMMENT ON COLUMN sys_department.dept_name IS '组织名称';
COMMENT ON COLUMN sys_department.sort_order IS '排序号, 数值越小越靠前';
COMMENT ON COLUMN sys_department.leader IS '负责人';
COMMENT ON COLUMN sys_department.phone IS '联系电话';
COMMENT ON COLUMN sys_department.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_department.remark IS '备注';
COMMENT ON COLUMN sys_department.create_by IS '创建人';
COMMENT ON COLUMN sys_department.create_time IS '创建时间';
COMMENT ON COLUMN sys_department.update_by IS '更新人';
COMMENT ON COLUMN sys_department.update_time IS '更新时间';

-- ============================================================================
-- 6. RBAC — 系统用户
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_user (
    id              text NOT NULL,
    username        text NOT NULL,
    password_hash   text NOT NULL,
    nickname        text,
    department_id   text,
    email           text,
    phone           text,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    last_login_time timestamp(6),
    last_login_ip   text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_user_pkey PRIMARY KEY (id),
    CONSTRAINT sys_user_username_unique UNIQUE (username)
);

COMMENT ON TABLE sys_user IS '系统用户表';
COMMENT ON COLUMN sys_user.id IS '主键 ID';
COMMENT ON COLUMN sys_user.username IS '用户名, 全局唯一';
COMMENT ON COLUMN sys_user.password_hash IS 'BCrypt 密码哈希';
COMMENT ON COLUMN sys_user.nickname IS '昵称 / 显示名称';
COMMENT ON COLUMN sys_user.department_id IS '所属组织 ID';
COMMENT ON COLUMN sys_user.email IS '邮箱';
COMMENT ON COLUMN sys_user.phone IS '手机号';
COMMENT ON COLUMN sys_user.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_user.remark IS '备注';
COMMENT ON COLUMN sys_user.last_login_time IS '最后登录时间';
COMMENT ON COLUMN sys_user.last_login_ip IS '最后登录 IP';
COMMENT ON COLUMN sys_user.create_by IS '创建人';
COMMENT ON COLUMN sys_user.create_time IS '创建时间';
COMMENT ON COLUMN sys_user.update_by IS '更新人';
COMMENT ON COLUMN sys_user.update_time IS '更新时间';

-- ============================================================================
-- 7. RBAC — 角色
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_role (
    id              text NOT NULL,
    role_code       text NOT NULL,
    role_name       text NOT NULL,
    role_type       text NOT NULL DEFAULT 'NORMAL',
    status          int4 NOT NULL DEFAULT 1,
    sort_order      int4 NOT NULL DEFAULT 0,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_role_pkey PRIMARY KEY (id),
    CONSTRAINT sys_role_code_unique UNIQUE (role_code)
);

COMMENT ON TABLE sys_role IS 'RBAC 角色表';
COMMENT ON COLUMN sys_role.id IS '主键 ID';
COMMENT ON COLUMN sys_role.role_code IS '角色编码, 全局唯一';
COMMENT ON COLUMN sys_role.role_name IS '角色名称';
COMMENT ON COLUMN sys_role.role_type IS '角色类型: SUPER_ADMIN / NORMAL';
COMMENT ON COLUMN sys_role.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_role.sort_order IS '排序号, 数值越小越靠前';
COMMENT ON COLUMN sys_role.remark IS '备注';
COMMENT ON COLUMN sys_role.create_by IS '创建人';
COMMENT ON COLUMN sys_role.create_time IS '创建时间';
COMMENT ON COLUMN sys_role.update_by IS '更新人';
COMMENT ON COLUMN sys_role.update_time IS '更新时间';

-- ============================================================================
-- 8. RBAC — 菜单
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_menu (
    id              text NOT NULL,
    parent_id       text NOT NULL DEFAULT '0',
    menu_name       text NOT NULL,
    path            text,
    component       text,
    icon            text,
    sort_order      int4 NOT NULL DEFAULT 0,
    status          int4 NOT NULL DEFAULT 1,
    permission_code text,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_menu_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE sys_menu IS '前端菜单与路由权限表';
COMMENT ON COLUMN sys_menu.id IS '主键 ID';
COMMENT ON COLUMN sys_menu.parent_id IS '父菜单 ID, 根节点为 0';
COMMENT ON COLUMN sys_menu.menu_name IS '菜单名称';
COMMENT ON COLUMN sys_menu.path IS '前端路由路径';
COMMENT ON COLUMN sys_menu.component IS '前端组件名';
COMMENT ON COLUMN sys_menu.icon IS '菜单图标';
COMMENT ON COLUMN sys_menu.sort_order IS '排序号, 数值越小越靠前';
COMMENT ON COLUMN sys_menu.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_menu.permission_code IS '权限码, 如 agent:ask';
COMMENT ON COLUMN sys_menu.remark IS '备注';
COMMENT ON COLUMN sys_menu.create_by IS '创建人';
COMMENT ON COLUMN sys_menu.create_time IS '创建时间';
COMMENT ON COLUMN sys_menu.update_by IS '更新人';
COMMENT ON COLUMN sys_menu.update_time IS '更新时间';

-- ============================================================================
-- 9. RBAC — API 资源
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_resource (
    id              text NOT NULL,
    menu_id         text,
    resource_name   text NOT NULL,
    resource_code   text NOT NULL,
    method          text NOT NULL,
    path            text NOT NULL,
    resource_type   text NOT NULL DEFAULT 'API',
    match_type      text NOT NULL DEFAULT 'EXACT',
    priority        int4 NOT NULL DEFAULT 0,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_resource_pkey PRIMARY KEY (id),
    CONSTRAINT sys_resource_code_unique UNIQUE (resource_code)
);

COMMENT ON TABLE sys_resource IS '后端 API 资源权限表';
COMMENT ON COLUMN sys_resource.id IS '主键 ID';
COMMENT ON COLUMN sys_resource.menu_id IS '关联的菜单 ID';
COMMENT ON COLUMN sys_resource.resource_name IS '资源名称';
COMMENT ON COLUMN sys_resource.resource_code IS '资源权限码, 全局唯一';
COMMENT ON COLUMN sys_resource.method IS 'HTTP 方法: GET / POST / PUT / DELETE';
COMMENT ON COLUMN sys_resource.path IS 'API 路径';
COMMENT ON COLUMN sys_resource.resource_type IS '资源类型, 默认 API';
COMMENT ON COLUMN sys_resource.match_type IS '匹配类型: EXACT / ANT';
COMMENT ON COLUMN sys_resource.priority IS 'ANT 匹配优先级, 数值越大越优先';
COMMENT ON COLUMN sys_resource.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_resource.remark IS '备注';
COMMENT ON COLUMN sys_resource.create_by IS '创建人';
COMMENT ON COLUMN sys_resource.create_time IS '创建时间';
COMMENT ON COLUMN sys_resource.update_by IS '更新人';
COMMENT ON COLUMN sys_resource.update_time IS '更新时间';

-- ============================================================================
-- 10. RBAC — 关联表
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_user_role (
    id              text NOT NULL,
    user_id         text NOT NULL,
    role_id         text NOT NULL,
    data_scope      text NOT NULL DEFAULT 'SELF',
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_user_role_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_user_role_unique
    ON sys_user_role(user_id, role_id) WHERE status <> 2;

COMMENT ON TABLE sys_user_role IS '用户-角色关联表';
COMMENT ON COLUMN sys_user_role.id IS '主键 ID';
COMMENT ON COLUMN sys_user_role.user_id IS '用户 ID';
COMMENT ON COLUMN sys_user_role.role_id IS '角色 ID';
COMMENT ON COLUMN sys_user_role.data_scope IS '数据范围: SELF / DEPT / DEPT_AND_SUB / ALL';
COMMENT ON COLUMN sys_user_role.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_user_role.remark IS '备注';
COMMENT ON COLUMN sys_user_role.create_by IS '创建人';
COMMENT ON COLUMN sys_user_role.create_time IS '创建时间';
COMMENT ON COLUMN sys_user_role.update_by IS '更新人';
COMMENT ON COLUMN sys_user_role.update_time IS '更新时间';

CREATE TABLE IF NOT EXISTS sys_role_menu (
    id              text NOT NULL,
    role_id         text NOT NULL,
    menu_id         text NOT NULL,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_role_menu_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_role_menu_unique
    ON sys_role_menu(role_id, menu_id) WHERE status <> 2;

COMMENT ON TABLE sys_role_menu IS '角色-菜单关联表';
COMMENT ON COLUMN sys_role_menu.id IS '主键 ID';
COMMENT ON COLUMN sys_role_menu.role_id IS '角色 ID';
COMMENT ON COLUMN sys_role_menu.menu_id IS '菜单 ID';
COMMENT ON COLUMN sys_role_menu.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_role_menu.remark IS '备注';
COMMENT ON COLUMN sys_role_menu.create_by IS '创建人';
COMMENT ON COLUMN sys_role_menu.create_time IS '创建时间';
COMMENT ON COLUMN sys_role_menu.update_by IS '更新人';
COMMENT ON COLUMN sys_role_menu.update_time IS '更新时间';

CREATE TABLE IF NOT EXISTS sys_role_resource (
    id              text NOT NULL,
    role_id         text NOT NULL,
    resource_id     text NOT NULL,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_role_resource_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_role_resource_unique
    ON sys_role_resource(role_id, resource_id) WHERE status <> 2;

COMMENT ON TABLE sys_role_resource IS '角色-资源关联表';
COMMENT ON COLUMN sys_role_resource.id IS '主键 ID';
COMMENT ON COLUMN sys_role_resource.role_id IS '角色 ID';
COMMENT ON COLUMN sys_role_resource.resource_id IS '资源 ID';
COMMENT ON COLUMN sys_role_resource.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_role_resource.remark IS '备注';
COMMENT ON COLUMN sys_role_resource.create_by IS '创建人';
COMMENT ON COLUMN sys_role_resource.create_time IS '创建时间';
COMMENT ON COLUMN sys_role_resource.update_by IS '更新人';
COMMENT ON COLUMN sys_role_resource.update_time IS '更新时间';

CREATE TABLE IF NOT EXISTS sys_role_agent (
    id              text NOT NULL,
    role_id         text NOT NULL,
    agent_id        text NOT NULL,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_role_agent_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_role_agent_unique
    ON sys_role_agent(role_id, agent_id) WHERE status <> 2;

COMMENT ON TABLE sys_role_agent IS '角色-Agent 授权关系表';
COMMENT ON COLUMN sys_role_agent.id IS '主键 ID';
COMMENT ON COLUMN sys_role_agent.role_id IS '角色 ID';
COMMENT ON COLUMN sys_role_agent.agent_id IS 'Agent ID';
COMMENT ON COLUMN sys_role_agent.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_role_agent.remark IS '备注';
COMMENT ON COLUMN sys_role_agent.create_by IS '创建人';
COMMENT ON COLUMN sys_role_agent.create_time IS '创建时间';
COMMENT ON COLUMN sys_role_agent.update_by IS '更新人';
COMMENT ON COLUMN sys_role_agent.update_time IS '更新时间';

-- ============================================================================
-- 11. Token 管理
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_refresh_token (
    id              text NOT NULL,
    token_id        text NOT NULL,
    user_id         text NOT NULL,
    expire_time     timestamp(6) NOT NULL,
    revoked         bool NOT NULL DEFAULT false,
    revoked_at      timestamp(6),
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_refresh_token_pkey PRIMARY KEY (id),
    CONSTRAINT sys_refresh_token_token_unique UNIQUE (token_id)
);

COMMENT ON TABLE sys_refresh_token IS 'Refresh Token 管理表';
COMMENT ON COLUMN sys_refresh_token.id IS '主键 ID';
COMMENT ON COLUMN sys_refresh_token.token_id IS 'Token 唯一标识';
COMMENT ON COLUMN sys_refresh_token.user_id IS '所属用户 ID';
COMMENT ON COLUMN sys_refresh_token.expire_time IS '过期时间';
COMMENT ON COLUMN sys_refresh_token.revoked IS '是否已吊销';
COMMENT ON COLUMN sys_refresh_token.revoked_at IS '吊销时间';
COMMENT ON COLUMN sys_refresh_token.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_refresh_token.remark IS '备注';
COMMENT ON COLUMN sys_refresh_token.create_by IS '创建人';
COMMENT ON COLUMN sys_refresh_token.create_time IS '创建时间';
COMMENT ON COLUMN sys_refresh_token.update_by IS '更新人';
COMMENT ON COLUMN sys_refresh_token.update_time IS '更新时间';

CREATE TABLE IF NOT EXISTS sys_token_blacklist (
    id              text NOT NULL,
    token_id        text NOT NULL,
    user_id         text,
    token_type      text NOT NULL,
    expire_time     timestamp(6) NOT NULL,
    invalidated_at  timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    invalidated_by  text,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_token_blacklist_pkey PRIMARY KEY (id),
    CONSTRAINT sys_token_blacklist_token_unique UNIQUE (token_id)
);

COMMENT ON TABLE sys_token_blacklist IS 'Token 黑名单表';
COMMENT ON COLUMN sys_token_blacklist.id IS '主键 ID';
COMMENT ON COLUMN sys_token_blacklist.token_id IS 'Token 唯一标识';
COMMENT ON COLUMN sys_token_blacklist.user_id IS '所属用户 ID';
COMMENT ON COLUMN sys_token_blacklist.token_type IS 'Token 类型: ACCESS / REFRESH';
COMMENT ON COLUMN sys_token_blacklist.expire_time IS '黑名单过期时间';
COMMENT ON COLUMN sys_token_blacklist.invalidated_at IS '加入黑名单时间';
COMMENT ON COLUMN sys_token_blacklist.invalidated_by IS '操作人';
COMMENT ON COLUMN sys_token_blacklist.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_token_blacklist.remark IS '备注';
COMMENT ON COLUMN sys_token_blacklist.create_by IS '创建人';
COMMENT ON COLUMN sys_token_blacklist.create_time IS '创建时间';
COMMENT ON COLUMN sys_token_blacklist.update_by IS '更新人';
COMMENT ON COLUMN sys_token_blacklist.update_time IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_sys_refresh_token_user   ON sys_refresh_token(user_id);
CREATE INDEX IF NOT EXISTS idx_sys_refresh_token_expire ON sys_refresh_token(expire_time);
CREATE INDEX IF NOT EXISTS idx_sys_token_blacklist_user   ON sys_token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_sys_token_blacklist_expire ON sys_token_blacklist(expire_time);

-- ============================================================================
-- 12. 访问审计 (不可变, 只 INSERT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_audit_access (
    id              text NOT NULL,
    trace_id        text NOT NULL,
    user_id         text,
    username        text,
    request_method  text NOT NULL,
    request_path    text NOT NULL,
    resource_code   text,
    access_result   text NOT NULL,
    deny_reason     text,
    client_ip       text,
    user_agent      text,
    request_time    timestamp(6) NOT NULL,
    response_time_ms int4,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_audit_access_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE sys_audit_access IS 'API 访问审计表 (不可变表, 只追加)';
COMMENT ON COLUMN sys_audit_access.id IS '主键 ID';
COMMENT ON COLUMN sys_audit_access.trace_id IS '关联的 Trace ID';
COMMENT ON COLUMN sys_audit_access.user_id IS '用户 ID';
COMMENT ON COLUMN sys_audit_access.username IS '用户名';
COMMENT ON COLUMN sys_audit_access.request_method IS 'HTTP 方法';
COMMENT ON COLUMN sys_audit_access.request_path IS '请求路径';
COMMENT ON COLUMN sys_audit_access.resource_code IS '匹配的资源权限码';
COMMENT ON COLUMN sys_audit_access.access_result IS '访问结果: GRANTED / DENIED / UNAUTHORIZED / UNREGISTERED / FAILED';
COMMENT ON COLUMN sys_audit_access.deny_reason IS '拒绝原因';
COMMENT ON COLUMN sys_audit_access.client_ip IS '客户端 IP';
COMMENT ON COLUMN sys_audit_access.user_agent IS '客户端 User-Agent';
COMMENT ON COLUMN sys_audit_access.request_time IS '请求时间';
COMMENT ON COLUMN sys_audit_access.response_time_ms IS '响应耗时 (毫秒)';
COMMENT ON COLUMN sys_audit_access.status IS '访问结果: 0=失败/拒绝, 1=成功/放行';
COMMENT ON COLUMN sys_audit_access.remark IS '备注';
COMMENT ON COLUMN sys_audit_access.create_by IS '创建人';
COMMENT ON COLUMN sys_audit_access.create_time IS '创建时间';
COMMENT ON COLUMN sys_audit_access.update_by IS '审计表无更新, 始终为空';
COMMENT ON COLUMN sys_audit_access.update_time IS '审计表无更新, 始终为默认值';

CREATE TABLE IF NOT EXISTS sys_audit_access_detail (
    id              text NOT NULL,
    audit_id        text NOT NULL,
    request_body    text,
    request_params  text,
    response_body   text,
    operation_summary text,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_audit_access_detail_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE sys_audit_access_detail IS 'API 访问审计明细表 (不可变表, 只追加)';
COMMENT ON COLUMN sys_audit_access_detail.id IS '主键 ID';
COMMENT ON COLUMN sys_audit_access_detail.audit_id IS '关联的审计记录 ID';
COMMENT ON COLUMN sys_audit_access_detail.request_body IS '请求体摘要';
COMMENT ON COLUMN sys_audit_access_detail.request_params IS '请求参数摘要';
COMMENT ON COLUMN sys_audit_access_detail.response_body IS '响应体摘要';
COMMENT ON COLUMN sys_audit_access_detail.operation_summary IS '操作摘要';
COMMENT ON COLUMN sys_audit_access_detail.status IS '记录状态: 0=异常, 1=正常';
COMMENT ON COLUMN sys_audit_access_detail.remark IS '备注';
COMMENT ON COLUMN sys_audit_access_detail.create_by IS '创建人';
COMMENT ON COLUMN sys_audit_access_detail.create_time IS '创建时间';
COMMENT ON COLUMN sys_audit_access_detail.update_by IS '审计表无更新, 始终为空';
COMMENT ON COLUMN sys_audit_access_detail.update_time IS '审计表无更新, 始终为默认值';

CREATE INDEX IF NOT EXISTS idx_sys_audit_access_user   ON sys_audit_access(user_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_access_trace  ON sys_audit_access(trace_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_access_result ON sys_audit_access(access_result);
CREATE INDEX IF NOT EXISTS idx_sys_audit_access_time   ON sys_audit_access(request_time);
CREATE INDEX IF NOT EXISTS idx_sys_audit_access_detail_audit ON sys_audit_access_detail(audit_id);

-- ============================================================================
-- 13. 模型供应商配置
-- ============================================================================
CREATE TABLE IF NOT EXISTS sys_model_provider (
    id              text NOT NULL,
    provider_code   text NOT NULL,
    provider_name   text NOT NULL,
    base_url        text,
    api_key         text NOT NULL,
    models          jsonb,
    default_model   text,
    is_enabled      int4 NOT NULL DEFAULT 1,
    sort_order      int4 NOT NULL DEFAULT 0,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT sys_model_provider_pkey PRIMARY KEY (id),
    CONSTRAINT sys_model_provider_code_unique UNIQUE (provider_code)
);

COMMENT ON TABLE sys_model_provider IS '模型供应商配置';
COMMENT ON COLUMN sys_model_provider.id IS '主键 ID';
COMMENT ON COLUMN sys_model_provider.provider_code IS '供应商编码 (唯一)';
COMMENT ON COLUMN sys_model_provider.provider_name IS '供应商名称';
COMMENT ON COLUMN sys_model_provider.base_url IS 'API Base URL';
COMMENT ON COLUMN sys_model_provider.api_key IS 'API Key (AES 加密存储)';
COMMENT ON COLUMN sys_model_provider.models IS '可用模型列表 JSON, 如 ["deepseek-v4-flash","deepseek-v4-pro"]';
COMMENT ON COLUMN sys_model_provider.default_model IS '默认使用的模型, 如 deepseek-v4-flash';
COMMENT ON COLUMN sys_model_provider.is_enabled IS '是否启用: 0=禁用, 1=启用';
COMMENT ON COLUMN sys_model_provider.sort_order IS '排序号';
COMMENT ON COLUMN sys_model_provider.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN sys_model_provider.remark IS '备注';
COMMENT ON COLUMN sys_model_provider.create_by IS '创建人';
COMMENT ON COLUMN sys_model_provider.create_time IS '创建时间';
COMMENT ON COLUMN sys_model_provider.update_by IS '更新人';
COMMENT ON COLUMN sys_model_provider.update_time IS '更新时间';

-- ============================================================================
-- 13.1 Tool 注册中心
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

-- ============================================================================
-- 14. 站内通知主体表
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_notification (
    id              text NOT NULL,
    title           text NOT NULL,
    content         text,
    category        text NOT NULL DEFAULT 'SYSTEM',
    sender_id       text,
    target_type     text NOT NULL DEFAULT 'USER',
    target_id       text,
    template_id     text,
    channel         text NOT NULL DEFAULT 'IN_APP',
    priority        int4 NOT NULL DEFAULT 0,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT agent_notification_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE agent_notification IS '站内通知主体表';
COMMENT ON COLUMN agent_notification.id IS '主键 ID';
COMMENT ON COLUMN agent_notification.title IS '通知标题';
COMMENT ON COLUMN agent_notification.content IS '通知正文, 支持 Markdown';
COMMENT ON COLUMN agent_notification.category IS '通知类型: SYSTEM=系统通知, TODO=待办提醒, AGENT=Agent通知, ANNOUNCEMENT=公告';
COMMENT ON COLUMN agent_notification.sender_id IS '发送者用户 ID, 系统通知为 system';
COMMENT ON COLUMN agent_notification.target_type IS '发送范围类型: USER=指定用户, ROLE=按角色, DEPARTMENT=按部门, ORG=全组织';
COMMENT ON COLUMN agent_notification.target_id IS '目标主体 ID, target_type=ORG 时为空';
COMMENT ON COLUMN agent_notification.template_id IS '关联的消息模板 ID';
COMMENT ON COLUMN agent_notification.channel IS '通知渠道: IN_APP=站内, EMAIL=邮件, DINGTALK=钉钉, WECOM=企业微信, SMS=短信';
COMMENT ON COLUMN agent_notification.priority IS '优先级: 0=普通, 1=重要, 2=紧急';
COMMENT ON COLUMN agent_notification.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN agent_notification.remark IS '备注';
COMMENT ON COLUMN agent_notification.create_by IS '创建人';
COMMENT ON COLUMN agent_notification.create_time IS '创建时间';
COMMENT ON COLUMN agent_notification.update_by IS '更新人';
COMMENT ON COLUMN agent_notification.update_time IS '更新时间';

-- ============================================================================
-- 15. 通知收件人记录表
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_notification_receipt (
    id              text NOT NULL,
    notification_id text NOT NULL,
    recipient_id    text NOT NULL,
    is_read         int4 NOT NULL DEFAULT 0,
    read_at         timestamp(6),
    is_deleted      int4 NOT NULL DEFAULT 0,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT agent_notification_receipt_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE agent_notification_receipt IS '通知收件人记录表, 发送通知时展开目标范围为具体收件人';
COMMENT ON COLUMN agent_notification_receipt.id IS '主键 ID';
COMMENT ON COLUMN agent_notification_receipt.notification_id IS '关联 agent_notification.id';
COMMENT ON COLUMN agent_notification_receipt.recipient_id IS '收件人用户 ID';
COMMENT ON COLUMN agent_notification_receipt.is_read IS '已读状态: 0=未读, 1=已读';
COMMENT ON COLUMN agent_notification_receipt.read_at IS '阅读时间';
COMMENT ON COLUMN agent_notification_receipt.is_deleted IS '用户删除标记: 0=正常, 1=用户已删除';
COMMENT ON COLUMN agent_notification_receipt.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN agent_notification_receipt.remark IS '备注';
COMMENT ON COLUMN agent_notification_receipt.create_by IS '创建人';
COMMENT ON COLUMN agent_notification_receipt.create_time IS '创建时间';
COMMENT ON COLUMN agent_notification_receipt.update_by IS '更新人';
COMMENT ON COLUMN agent_notification_receipt.update_time IS '更新时间';

-- ============================================================================
-- 16. 通知消息模板表
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_notification_template (
    id               text NOT NULL,
    template_code    text NOT NULL,
    title_template   text NOT NULL,
    content_template text NOT NULL,
    variables        jsonb,
    channel          text NOT NULL DEFAULT 'IN_APP',
    status           int4 NOT NULL DEFAULT 1,
    remark           text,
    create_by        text,
    create_time      timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by        text,
    update_time      timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT agent_notification_template_pkey PRIMARY KEY (id),
    CONSTRAINT agent_notification_template_code_unique UNIQUE (template_code)
);

COMMENT ON TABLE agent_notification_template IS '通知消息模板';
COMMENT ON COLUMN agent_notification_template.id IS '主键 ID';
COMMENT ON COLUMN agent_notification_template.template_code IS '模板编码, 全局唯一, 如 todo.reminder';
COMMENT ON COLUMN agent_notification_template.title_template IS '标题模板, 支持 {{变量名}} 占位';
COMMENT ON COLUMN agent_notification_template.content_template IS '内容模板, 支持 {{变量名}} 占位';
COMMENT ON COLUMN agent_notification_template.variables IS '变量定义, JSON 数组: [{"name":"todoTitle","required":true,"description":"待办标题"}]';
COMMENT ON COLUMN agent_notification_template.channel IS '默认发送渠道: IN_APP / EMAIL / DINGTALK / WECOM / SMS';
COMMENT ON COLUMN agent_notification_template.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN agent_notification_template.remark IS '备注';
COMMENT ON COLUMN agent_notification_template.create_by IS '创建人';
COMMENT ON COLUMN agent_notification_template.create_time IS '创建时间';
COMMENT ON COLUMN agent_notification_template.update_by IS '更新人';
COMMENT ON COLUMN agent_notification_template.update_time IS '更新时间';

-- ============================================================================
-- 17. 待办事项表
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_todo (
    id                text NOT NULL,
    title             text NOT NULL,
    description       text,
    assignee_user_id  text,
    created_by        text,
    status            int4 NOT NULL DEFAULT 0,
    priority          int4 NOT NULL DEFAULT 0,
    due_date          timestamp(6),
    remind_at         timestamp(6),
    calendar_event_id text,
    visibility        text NOT NULL DEFAULT 'private',
    remark            text,
    create_time       timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by         text,
    update_time       timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT agent_todo_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE agent_todo IS 'Agent 待办事项';
COMMENT ON COLUMN agent_todo.id IS '主键 ID';
COMMENT ON COLUMN agent_todo.title IS '待办标题';
COMMENT ON COLUMN agent_todo.description IS '待办详细描述';
COMMENT ON COLUMN agent_todo.assignee_user_id IS '负责人用户 ID';
COMMENT ON COLUMN agent_todo.created_by IS '创建人用户 ID';
COMMENT ON COLUMN agent_todo.status IS '状态: 0=待开始, 1=进行中, 2=已完成, 3=已取消, 99=删除';
COMMENT ON COLUMN agent_todo.priority IS '优先级: 0=无, 1=低, 2=中, 3=高, 4=紧急';
COMMENT ON COLUMN agent_todo.due_date IS '截止日期';
COMMENT ON COLUMN agent_todo.remind_at IS '提醒时间, 业务层校验必须早于 due_date';
COMMENT ON COLUMN agent_todo.calendar_event_id IS '关联日历事件 ID';
COMMENT ON COLUMN agent_todo.visibility IS '可见范围: private=仅负责人和创建人, team=部门/角色范围, org=租户内全员可读';
COMMENT ON COLUMN agent_todo.remark IS '备注';
COMMENT ON COLUMN agent_todo.create_time IS '创建时间';
COMMENT ON COLUMN agent_todo.update_by IS '更新人';
COMMENT ON COLUMN agent_todo.update_time IS '更新时间';

-- ============================================================================
-- 18. 待办行级权限控制表
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_todo_acl (
    id            text NOT NULL,
    todo_id       text NOT NULL,
    subject_type  text NOT NULL,
    subject_id    text NOT NULL,
    permission    text NOT NULL DEFAULT 'READ',
    status        int4 NOT NULL DEFAULT 1,
    remark        text,
    create_by     text,
    create_time   timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by     text,
    update_time   timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT agent_todo_acl_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE agent_todo_acl IS '待办行级权限控制表';
COMMENT ON COLUMN agent_todo_acl.id IS '主键 ID';
COMMENT ON COLUMN agent_todo_acl.todo_id IS '关联 agent_todo.id';
COMMENT ON COLUMN agent_todo_acl.subject_type IS '授权主体类型: USER / ROLE / DEPARTMENT';
COMMENT ON COLUMN agent_todo_acl.subject_id IS '授权主体 ID';
COMMENT ON COLUMN agent_todo_acl.permission IS '权限级别: READ=只读, WRITE=可编辑';
COMMENT ON COLUMN agent_todo_acl.status IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN agent_todo_acl.remark IS '备注';
COMMENT ON COLUMN agent_todo_acl.create_by IS '创建人';
COMMENT ON COLUMN agent_todo_acl.create_time IS '创建时间';
COMMENT ON COLUMN agent_todo_acl.update_by IS '更新人';
COMMENT ON COLUMN agent_todo_acl.update_time IS '更新时间';

-- ============================================================================
-- 19. 待办提醒记录表
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_todo_reminder (
    id            text NOT NULL,
    todo_id       text NOT NULL,
    channel       text NOT NULL DEFAULT 'IN_APP',
    scheduled_at  timestamp(6) NOT NULL,
    sent_at       timestamp(6),
    status        int4 NOT NULL DEFAULT 0,
    retry_count   int4 NOT NULL DEFAULT 0,
    remark        text,
    create_by     text,
    create_time   timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by     text,
    update_time   timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT agent_todo_reminder_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE agent_todo_reminder IS '待办提醒记录';
COMMENT ON COLUMN agent_todo_reminder.id IS '主键 ID';
COMMENT ON COLUMN agent_todo_reminder.todo_id IS '关联 agent_todo.id';
COMMENT ON COLUMN agent_todo_reminder.channel IS '提醒渠道: IN_APP / EMAIL / DINGTALK / WECOM / SMS';
COMMENT ON COLUMN agent_todo_reminder.scheduled_at IS '计划发送时间';
COMMENT ON COLUMN agent_todo_reminder.sent_at IS '实际发送时间';
COMMENT ON COLUMN agent_todo_reminder.status IS '状态: 0=待发送, 1=已发送, 2=发送失败, 3=已取消';
COMMENT ON COLUMN agent_todo_reminder.retry_count IS '重试次数, 上限 4 次, 指数退避 1min/5min/15min/60min';
COMMENT ON COLUMN agent_todo_reminder.remark IS '备注';
COMMENT ON COLUMN agent_todo_reminder.create_by IS '创建人';
COMMENT ON COLUMN agent_todo_reminder.create_time IS '创建时间';
COMMENT ON COLUMN agent_todo_reminder.update_by IS '更新人';
COMMENT ON COLUMN agent_todo_reminder.update_time IS '更新时间';

-- ============================================================================
-- 20. 会话轮次记录表 (不可变, 只 INSERT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_record (
    id              text NOT NULL,
    session_id      text NOT NULL,
    turn_id         text NOT NULL,
    user_id         text,
    agent_id        text,
    user_input      text,
    agent_reply     text,
    summary         text,
    status          int4 NOT NULL DEFAULT 1,
    remark          text,
    create_by       text,
    create_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    update_by       text,
    update_time     timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT conversation_record_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE conversation_record IS '会话轮次记录 (不可变表, 只追加)';
COMMENT ON COLUMN conversation_record.id IS '主键 ID';
COMMENT ON COLUMN conversation_record.session_id IS '会话 ID';
COMMENT ON COLUMN conversation_record.turn_id IS '轮次 ID, 对应前端每次发送';
COMMENT ON COLUMN conversation_record.user_id IS '用户 ID';
COMMENT ON COLUMN conversation_record.agent_id IS '处理此轮次的 Agent ID';
COMMENT ON COLUMN conversation_record.user_input IS '用户原始输入';
COMMENT ON COLUMN conversation_record.agent_reply IS 'Agent 最终回复';
COMMENT ON COLUMN conversation_record.summary IS '该轮摘要 (用于全文检索)';
COMMENT ON COLUMN conversation_record.status IS '记录状态: 0=异常, 1=正常';
COMMENT ON COLUMN conversation_record.remark IS '备注';
COMMENT ON COLUMN conversation_record.create_by IS '创建人';
COMMENT ON COLUMN conversation_record.create_time IS '创建时间';
COMMENT ON COLUMN conversation_record.update_by IS '日志表无更新, 始终为空';
COMMENT ON COLUMN conversation_record.update_time IS '日志表无更新, 始终为默认值';

-- ============================================================================
-- 索引：通知 & 待办
-- ============================================================================

-- 通知收件人: 用户收件箱主查询
CREATE INDEX IF NOT EXISTS idx_notification_receipt_recipient
    ON agent_notification_receipt (recipient_id, is_deleted, is_read);

-- 通知收件人: 未读数量查询 (部分索引)
CREATE INDEX IF NOT EXISTS idx_notification_receipt_unread
    ON agent_notification_receipt (recipient_id)
    WHERE is_read = 0 AND is_deleted = 0;

-- 通知收件人: 按通知 ID 查询收件人
CREATE INDEX IF NOT EXISTS idx_notification_receipt_nid
    ON agent_notification_receipt (notification_id);

-- 通知模板: 按编码查询活跃模板
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_template_code
    ON agent_notification_template (template_code) WHERE status = 1;

-- 待办: 按负责人+状态查询 (最高频)
CREATE INDEX IF NOT EXISTS idx_agent_todo_assignee_status
    ON agent_todo (assignee_user_id, status);

-- 待办: 按截止日期排序
CREATE INDEX IF NOT EXISTS idx_agent_todo_due_date
    ON agent_todo (due_date);

-- 待办: 按创建人查询
CREATE INDEX IF NOT EXISTS idx_agent_todo_created_by
    ON agent_todo (created_by);

-- 待办 ACL: 行级权限唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_todo_acl_unique
    ON agent_todo_acl (todo_id, subject_type, subject_id);

-- 待办 ACL: 按主体查询
CREATE INDEX IF NOT EXISTS idx_agent_todo_acl_subject
    ON agent_todo_acl (subject_type, subject_id);

-- 待办提醒: 定时任务扫描待发送记录 (部分索引)
CREATE INDEX IF NOT EXISTS idx_agent_todo_reminder_pending
    ON agent_todo_reminder (status, scheduled_at)
    WHERE status = 0;

-- 会话记录: 按会话+时间查询
CREATE INDEX IF NOT EXISTS idx_conv_session ON conversation_record (session_id, create_time);

-- ============================================================================
-- 21. Text2SQL 外部数据源连接（系统连接器）
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."text2sql_data_connection" (
    "id" text COLLATE "pg_catalog"."default" NOT NULL,
    "display_name" text COLLATE "pg_catalog"."default" NOT NULL,
    "db_type" text COLLATE "pg_catalog"."default" NOT NULL,
    "host" text COLLATE "pg_catalog"."default" NOT NULL,
    "port" int4 NOT NULL DEFAULT 3306,
    "database_name" text COLLATE "pg_catalog"."default" NOT NULL,
    "username" text COLLATE "pg_catalog"."default" NOT NULL,
    "password_enc" text COLLATE "pg_catalog"."default" NOT NULL,
    "jdbc_params" text COLLATE "pg_catalog"."default",
    "status" int4 NOT NULL DEFAULT 1,
    "remark" text COLLATE "pg_catalog"."default",
    "create_by" text COLLATE "pg_catalog"."default",
    "create_time" timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    "update_by" text COLLATE "pg_catalog"."default",
    "update_time" timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT "text2sql_data_connection_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "public"."text2sql_data_connection" IS 'Text2SQL 外部数据源连接配置, 密码 AES 加密存储';
COMMENT ON COLUMN "public"."text2sql_data_connection"."id" IS '主键 ID';
COMMENT ON COLUMN "public"."text2sql_data_connection"."display_name" IS '连接显示名称';
COMMENT ON COLUMN "public"."text2sql_data_connection"."db_type" IS '数据库类型: 当前仅 MYSQL';
COMMENT ON COLUMN "public"."text2sql_data_connection"."host" IS '数据库主机';
COMMENT ON COLUMN "public"."text2sql_data_connection"."port" IS '端口, MySQL 默认 3306';
COMMENT ON COLUMN "public"."text2sql_data_connection"."database_name" IS '库名 / schema';
COMMENT ON COLUMN "public"."text2sql_data_connection"."username" IS '登录用户名';
COMMENT ON COLUMN "public"."text2sql_data_connection"."password_enc" IS '登录密码密文 (AES)';
COMMENT ON COLUMN "public"."text2sql_data_connection"."jdbc_params" IS '可选 JDBC 查询串片段, 如 useSSL=false';
COMMENT ON COLUMN "public"."text2sql_data_connection"."status" IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN "public"."text2sql_data_connection"."remark" IS '备注';
COMMENT ON COLUMN "public"."text2sql_data_connection"."create_by" IS '创建人';
COMMENT ON COLUMN "public"."text2sql_data_connection"."create_time" IS '创建时间';
COMMENT ON COLUMN "public"."text2sql_data_connection"."update_by" IS '更新人';
COMMENT ON COLUMN "public"."text2sql_data_connection"."update_time" IS '更新时间';

CREATE INDEX IF NOT EXISTS idx_text2sql_conn_status
    ON text2sql_data_connection (status);

-- ============================================================================
-- 22. Text2SQL Schema 缓存快照
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."data_source_schema_cache" (
    "id" text COLLATE "pg_catalog"."default" NOT NULL,
    "connection_id" text COLLATE "pg_catalog"."default" NOT NULL,
    "db_type" text COLLATE "pg_catalog"."default" NOT NULL,
    "schema_snapshot" jsonb,
    "sample_values" jsonb,
    "refreshed_at" timestamp(6),
    "refresh_status" int4 NOT NULL DEFAULT 0,
    "refresh_error" text COLLATE "pg_catalog"."default",
    "status" int4 NOT NULL DEFAULT 1,
    "remark" text COLLATE "pg_catalog"."default",
    "create_by" text COLLATE "pg_catalog"."default",
    "create_time" timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    "update_by" text COLLATE "pg_catalog"."default",
    "update_time" timestamp(6) NOT NULL DEFAULT LOCALTIMESTAMP(6),
    CONSTRAINT "data_source_schema_cache_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "public"."data_source_schema_cache" IS 'Text2SQL 外部数据源 Schema 缓存快照';
COMMENT ON COLUMN "public"."data_source_schema_cache"."id" IS '主键, conn_{connection_id}';
COMMENT ON COLUMN "public"."data_source_schema_cache"."connection_id" IS '关联 text2sql_data_connection.id';
COMMENT ON COLUMN "public"."data_source_schema_cache"."db_type" IS '数据库类型: MYSQL';
COMMENT ON COLUMN "public"."data_source_schema_cache"."schema_snapshot" IS '完整 Schema JSON (表/列/外键)';
COMMENT ON COLUMN "public"."data_source_schema_cache"."sample_values" IS '示例值 JSON (预留)';
COMMENT ON COLUMN "public"."data_source_schema_cache"."refreshed_at" IS '上次刷新时间';
COMMENT ON COLUMN "public"."data_source_schema_cache"."refresh_status" IS '刷新状态: 0=待刷新, 1=成功, 2=失败';
COMMENT ON COLUMN "public"."data_source_schema_cache"."refresh_error" IS '上次刷新失败原因';
COMMENT ON COLUMN "public"."data_source_schema_cache"."status" IS '状态: 0=暂存, 1=正常, 2=删除';
COMMENT ON COLUMN "public"."data_source_schema_cache"."remark" IS '备注';
COMMENT ON COLUMN "public"."data_source_schema_cache"."create_by" IS '创建人';
COMMENT ON COLUMN "public"."data_source_schema_cache"."create_time" IS '创建时间';
COMMENT ON COLUMN "public"."data_source_schema_cache"."update_by" IS '更新人';
COMMENT ON COLUMN "public"."data_source_schema_cache"."update_time" IS '更新时间';

-- ============================================================================
-- 001_schema.sql 完成 (22 张表)
-- ============================================================================
