import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpenCheck,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleOff,
  DatabaseZap,
  FileKey2,
  FolderTree,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import { UiTabs } from "@/src/components/ui/primitives.tsx";
import { syncAppUrlParams, type RbacSection } from "@/src/lib/urlParams.ts";
import { useAuth } from "../../auth.tsx";

type AdminSection = "users" | "departments" | "menus" | "resources" | "roles";
type DataScope = "SELF" | "DEPT" | "DEPT_AND_SUB" | "ALL";
type FormMode = "create" | "edit";
type PermissionPanel = "roles" | "grants";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

type RowData = Record<string, unknown>;

type TreeNode = RowData & {
  id: string;
  parentId?: string;
  children?: TreeNode[];
};

type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "password" | "select" | "textarea" | "checkboxGroup";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  colSpan?: "full";
};

type FormDialog = {
  title: string;
  description?: string;
  fields: FormField[];
  initialValues: RowData;
  submitText: string;
  onSubmit: (values: RowData) => Promise<void>;
};

type ConfirmDialog = {
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => Promise<void>;
};

type DialogState = null | { type: "form"; data: FormDialog } | { type: "confirm"; data: ConfirmDialog };

type TableColumn = {
  key: string;
  title: string;
  width?: string;
  render?: (row: RowData) => React.ReactNode;
};

type SectionConfig = {
  id: AdminSection;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  endpoint: string;
  viewPermission: string;
  addPermission: string;
  editPermission: string;
  deletePermission: string;
};

const SECTION_CONFIG: Record<AdminSection, SectionConfig> = {
  users: {
    id: "users",
    title: "人员管理",
    subtitle: "维护账号、组织归属和数据范围",
    icon: UsersRound,
    endpoint: "/api/rbac/users",
    viewPermission: "system:user:view",
    addPermission: "system:user:add",
    editPermission: "system:user:edit",
    deletePermission: "system:user:delete",
  },
  departments: {
    id: "departments",
    title: "组织管理",
    subtitle: "按层级维护部门、负责人和排序",
    icon: Building2,
    endpoint: "/api/rbac/departments",
    viewPermission: "system:dept:view",
    addPermission: "system:dept:add",
    editPermission: "system:dept:edit",
    deletePermission: "system:dept:delete",
  },
  menus: {
    id: "menus",
    title: "菜单管理",
    subtitle: "维护导航树、路由路径和菜单权限码",
    icon: FolderTree,
    endpoint: "/api/rbac/menus",
    viewPermission: "system:menu:view",
    addPermission: "system:menu:add",
    editPermission: "system:menu:edit",
    deletePermission: "system:menu:delete",
  },
  resources: {
    id: "resources",
    title: "资源管理",
    subtitle: "维护接口资源、匹配方式和授权编码",
    icon: DatabaseZap,
    endpoint: "/api/rbac/resources",
    viewPermission: "system:resource:view",
    addPermission: "system:resource:add",
    editPermission: "system:resource:edit",
    deletePermission: "system:resource:delete",
  },
  roles: {
    id: "roles",
    title: "权限管理",
    subtitle: "维护角色，并给角色配置菜单与资源权限",
    icon: ShieldCheck,
    endpoint: "/api/rbac/roles",
    viewPermission: "system:role:view",
    addPermission: "system:role:add",
    editPermission: "system:role:edit",
    deletePermission: "system:role:delete",
  },
};

const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  SELF: "仅本人",
  DEPT: "本组织",
  DEPT_AND_SUB: "本组织及下级",
  ALL: "全部数据",
};

const ROLE_TYPE_LABEL: Record<string, string> = {
  NORMAL: "普通角色",
  SUPER_ADMIN: "超级管理员",
};

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const RESOURCE_TYPES = ["API", "MENU", "BUTTON", "DATA"];
const MATCH_TYPES = ["EXACT", "ANT"];

export function AdminRbacConsole({ initialSection = "users" }: { initialSection?: AdminSection }) {
  const { accessToken, can } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>(initialSection);
  const [permissionPanel, setPermissionPanel] = useState<PermissionPanel>("roles");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [expandedTree, setExpandedTree] = useState<Record<string, boolean>>({});

  const [users, setUsers] = useState<RowData[]>([]);
  const [departments, setDepartments] = useState<RowData[]>([]);
  const [departmentTree, setDepartmentTree] = useState<TreeNode[]>([]);
  const [menus, setMenus] = useState<RowData[]>([]);
  const [menuTree, setMenuTree] = useState<TreeNode[]>([]);
  const [resources, setResources] = useState<RowData[]>([]);
  const [roles, setRoles] = useState<RowData[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [grantDirty, setGrantDirty] = useState(false);

  useEffect(() => {
    setActiveSection(initialSection);
    if (initialSection === "roles") {
      setPermissionPanel("roles");
    }
  }, [initialSection]);

  const canViewAdmin = useMemo(() => {
    return Object.values(SECTION_CONFIG).some((item) => can(item.viewPermission));
  }, [can]);

  const authedFetch = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await fetch(url, { ...init, headers });
    const text = await response.text();
    let payload: ApiEnvelope<T>;
    try {
      payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : ({ success: response.ok, data: null as T } as ApiEnvelope<T>);
    } catch {
      throw new Error(`接口返回不是 JSON：${response.status}`);
    }
    if (!response.ok || !payload.success) throw new Error(payload.message || `HTTP ${response.status}`);
    return payload.data;
  };

  const loadCore = async () => {
    if (!canViewAdmin) return;
    setBusy(true);
    setMessage("");
    try {
      const [userRows, departmentRows, departmentNodes, menuRows, menuNodes, resourceRows, roleRows] = await Promise.all([
        can("system:user:view") ? authedFetch<RowData[]>("/api/rbac/users") : Promise.resolve([]),
        can("system:dept:view") ? authedFetch<RowData[]>("/api/rbac/departments") : Promise.resolve([]),
        can("system:dept:view") ? authedFetch<TreeNode[]>("/api/rbac/departments/tree") : Promise.resolve([]),
        can("system:menu:view") ? authedFetch<RowData[]>("/api/rbac/menus") : Promise.resolve([]),
        can("system:menu:view") ? authedFetch<TreeNode[]>("/api/rbac/menus/tree") : Promise.resolve([]),
        can("system:resource:view") ? authedFetch<RowData[]>("/api/rbac/resources") : Promise.resolve([]),
        can("system:role:view") ? authedFetch<RowData[]>("/api/rbac/roles") : Promise.resolve([]),
      ]);
      setUsers(userRows);
      setDepartments(departmentRows);
      setDepartmentTree(departmentNodes);
      setMenus(menuRows);
      setMenuTree(menuNodes);
      setResources(resourceRows);
      setRoles(roleRows);
      setExpandedTree((prev) => ({ ...buildExpandState(departmentNodes), ...buildExpandState(menuNodes), ...prev }));
      setSelectedRoleId((current) => current || stringValue(roleRows[0], "id"));
    } catch (error) {
      setMessage(errorMessage(error, "数据加载失败"));
    } finally {
      setBusy(false);
    }
  };

  const loadRoleBindings = async (roleId: string) => {
    if (!roleId) return;
    setSaving(true);
    setMessage("");
    try {
      const [menuIds, resourceIds] = await Promise.all([
        authedFetch<string[]>(`/api/rbac/roles/${roleId}/menus`),
        authedFetch<string[]>(`/api/rbac/roles/${roleId}/resources`),
      ]);
      setSelectedMenuIds(menuIds);
      setSelectedResourceIds(resourceIds);
      setGrantDirty(false);
    } catch (error) {
      setMessage(errorMessage(error, "角色授权加载失败"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadCore();
  }, [canViewAdmin]);

  useEffect(() => {
    if (activeSection !== "roles" || permissionPanel !== "grants" || !selectedRoleId) return;
    void loadRoleBindings(selectedRoleId);
  }, [activeSection, permissionPanel, selectedRoleId]);

  const activeConfig = SECTION_CONFIG[activeSection];
  const currentRows = getRows(activeSection, { users, departments, menus, resources, roles });
  const filteredRows = filterRows(currentRows, query);
  const departmentOptions = useMemo(() => toTreeOptions(departmentTree, "deptName"), [departmentTree]);
  const menuOptions = useMemo(() => menus.map((item) => ({ value: stringValue(item, "id"), label: stringValue(item, "menuName") || stringValue(item, "id") })), [menus]);
  const selectedRole = roles.find((item) => stringValue(item, "id") === selectedRoleId);

  const openForm = (section: AdminSection, mode: FormMode, row?: RowData) => {
    const config = SECTION_CONFIG[section];
    const fields = fieldsFor(section, {
      departmentOptions: [{ value: "", label: "不关联组织" }, ...departmentOptions],
      parentDepartmentOptions: [{ value: "", label: "根组织" }, ...departmentOptions],
      menuOptions: [{ value: "", label: "不关联菜单" }, ...menuOptions],
      parentMenuOptions: [{ value: "", label: "根菜单" }, ...toTreeOptions(menuTree, "menuName")],
    });
    setDialog({
      type: "form",
      data: {
        title: `${mode === "create" ? "新增" : "编辑"}${section === "roles" ? "角色" : config.title.replace("管理", "")}`,
        description: mode === "create" ? "只填写必要信息即可，后续可以继续补充。" : "已带入当前记录，修改后保存即可。",
        fields,
        initialValues: initialValuesFor(section, mode, row),
        submitText: mode === "create" ? "新增" : "保存",
        onSubmit: async (values) => {
          const payload = cleanPayload(section, values);
          if (mode === "create") {
            await authedFetch(config.endpoint, { method: "POST", body: JSON.stringify(payload) });
            setMessage("新增成功");
          } else {
            await authedFetch(`${config.endpoint}/${stringValue(row, "id")}`, { method: "PUT", body: JSON.stringify(payload) });
            setMessage("保存成功");
          }
          await loadCore();
        },
      },
    });
  };

  const confirmDelete = (section: AdminSection, row: RowData) => {
    const config = SECTION_CONFIG[section];
    setDialog({
      type: "confirm",
      data: {
        title: "确认删除",
        description: `将删除「${displayName(section, row)}」。删除后会从当前列表移除。`,
        confirmText: "删除",
        onConfirm: async () => {
          await authedFetch(`${config.endpoint}/${stringValue(row, "id")}`, { method: "DELETE" });
          setMessage("删除成功");
          await loadCore();
        },
      },
    });
  };

  const saveUserRoles = async (user: RowData) => {
    const userId = stringValue(user, "id");
    setSaving(true);
    try {
      const currentRoleIds = await authedFetch<string[]>(`/api/rbac/users/${userId}/roles`);
      setDialog({
        type: "form",
        data: {
          title: "分配用户角色",
          description: `${displayName("users", user)} 的角色与数据范围会一起保存。`,
          fields: [
            {
              name: "roleIds",
              label: "角色",
              type: "checkboxGroup",
              options: roles.map((role) => ({ value: stringValue(role, "id"), label: roleLabel(role) })),
            },
            {
              name: "dataScope",
              label: "数据范围",
              type: "select",
              options: Object.entries(DATA_SCOPE_LABEL).map(([value, label]) => ({ value, label })),
            },
          ],
          initialValues: {
            roleIds: currentRoleIds,
            dataScope: normalizeDataScope(stringValue(user, "dataScope")),
          },
          submitText: "保存角色",
          onSubmit: async (values) => {
            const roleIds = Array.isArray(values.roleIds) ? values.roleIds.map(String) : [];
            await authedFetch(`/api/rbac/users/${userId}/roles?dataScope=${normalizeDataScope(stringValue(values, "dataScope"))}`, {
              method: "POST",
              body: JSON.stringify(roleIds),
            });
            setMessage("用户角色已更新");
            await loadCore();
          },
        },
      });
    } catch (error) {
      setMessage(errorMessage(error, "用户角色加载失败"));
    } finally {
      setSaving(false);
    }
  };

  const saveRoleGrants = async () => {
    if (!selectedRoleId) {
      setMessage("请先选择角色");
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        authedFetch(`/api/rbac/roles/${selectedRoleId}/menus`, { method: "POST", body: JSON.stringify(selectedMenuIds) }),
        authedFetch(`/api/rbac/roles/${selectedRoleId}/resources`, { method: "POST", body: JSON.stringify(selectedResourceIds) }),
      ]);
      setGrantDirty(false);
      setMessage("角色权限已保存");
    } catch (error) {
      setMessage(errorMessage(error, "角色权限保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const toggleMenuGrant = (node: TreeNode) => {
    const ids = collectTreeIds(node);
    const everyChecked = ids.every((id) => selectedMenuIds.includes(id));
    setSelectedMenuIds((current) => (everyChecked ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids]))));
    setGrantDirty(true);
  };

  const toggleResourceGrant = (id: string) => {
    setSelectedResourceIds((current) => toggleValue(current, id));
    setGrantDirty(true);
  };

  if (!canViewAdmin) {
    return (
      <div className="ui-card p-6">
        <div className="flex items-center gap-3 text-rose-700">
          <CircleOff className="h-5 w-5" />
          <div>
            <div className="font-semibold">当前账号没有访问系统管理的权限</div>
            <p className="mt-1 text-sm text-rose-600">请联系管理员确认菜单和资源授权。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-4">
      <section className="ui-card-strong p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control-md)] bg-slate-900 text-white">
              <activeConfig.icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">{activeConfig.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{activeConfig.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Metric label="人员" value={users.length} />
            <Metric label="组织" value={departments.length} />
            <Metric label="角色" value={roles.length} />
            <Metric label="资源" value={resources.length} />
          </div>
        </div>
      </section>

      <section className="ui-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <UiTabs
            className="mb-0 min-w-0 flex-1"
            tabs={Object.values(SECTION_CONFIG).map((item) => {
              const Icon = item.icon;
              return {
                id: item.id,
                label: item.title,
                icon: <Icon className="h-4 w-4" />,
              };
            })}
            activeTab={activeSection}
            onChange={(id) => {
              const next = id as AdminSection;
              setActiveSection(next);
              setQuery("");
              syncAppUrlParams({ rbacSection: next as RbacSection });
              if (next === "roles") {
                setPermissionPanel("roles");
              }
            }}
          />

          <div className="flex min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="ui-input h-10 pl-9"
                placeholder="搜索名称、编码、路径、负责人"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button className="ui-btn-secondary h-10 px-3" disabled={busy} onClick={() => void loadCore()} type="button">
              <RefreshCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              刷新
            </button>
            {can(activeConfig.addPermission) ? (
              <button className="ui-btn-primary h-10 px-3" onClick={() => openForm(activeSection, "create")} type="button">
                <Plus className="h-4 w-4" />
                新增
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-[var(--radius-control-md)] border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
          {message}
        </div>
      ) : null}

      {activeSection === "roles" ? (
        <RolePermissionView
          canEditRole={can(SECTION_CONFIG.roles.editPermission)}
          canDeleteRole={can(SECTION_CONFIG.roles.deletePermission)}
          expandedTree={expandedTree}
          filteredRoles={filteredRows}
          grantDirty={grantDirty}
          menuTree={menuTree}
          onDelete={(row) => confirmDelete("roles", row)}
          onEdit={(row) => openForm("roles", "edit", row)}
          onPanelChange={setPermissionPanel}
          onRoleChange={setSelectedRoleId}
          onSave={() => void saveRoleGrants()}
          onToggleExpand={(id) => setExpandedTree((prev) => ({ ...prev, [id]: !prev[id] }))}
          onToggleMenu={toggleMenuGrant}
          onToggleResource={toggleResourceGrant}
          panel={permissionPanel}
          query={query}
          resources={resources}
          saving={saving}
          selectedMenuIds={selectedMenuIds}
          selectedResourceIds={selectedResourceIds}
          selectedRole={selectedRole}
          selectedRoleId={selectedRoleId}
        />
      ) : activeSection === "departments" ? (
        <TreeManagementPanel
          canDelete={can(activeConfig.deletePermission)}
          canEdit={can(activeConfig.editPermission)}
          columns={departmentColumns()}
          emptyText="暂无组织"
          expandedTree={expandedTree}
          nodes={query ? buildTreeFromRows(filteredRows) : departmentTree}
          onDelete={(row) => confirmDelete("departments", row)}
          onEdit={(row) => openForm("departments", "edit", row)}
          onToggleExpand={(id) => setExpandedTree((prev) => ({ ...prev, [id]: !prev[id] }))}
        />
      ) : activeSection === "menus" ? (
        <TreeManagementPanel
          canDelete={can(activeConfig.deletePermission)}
          canEdit={can(activeConfig.editPermission)}
          columns={menuColumns()}
          emptyText="暂无菜单"
          expandedTree={expandedTree}
          nodes={query ? buildTreeFromRows(filteredRows) : menuTree}
          onDelete={(row) => confirmDelete("menus", row)}
          onEdit={(row) => openForm("menus", "edit", row)}
          onToggleExpand={(id) => setExpandedTree((prev) => ({ ...prev, [id]: !prev[id] }))}
        />
      ) : (
        <DataTable
          canDelete={can(activeConfig.deletePermission)}
          canEdit={can(activeConfig.editPermission)}
          columns={columnsFor(activeSection)}
          emptyText={busy ? "正在加载..." : "暂无数据"}
          extraAction={activeSection === "users" && can("system:role:grant") ? (row) => (
            <button className="ui-btn-secondary h-8 px-2 text-xs" disabled={saving} onClick={() => void saveUserRoles(row)} type="button">
              <UserCog className="h-3.5 w-3.5" />
              分配角色
            </button>
          ) : undefined}
          onDelete={(row) => confirmDelete(activeSection, row)}
          onEdit={(row) => openForm(activeSection, "edit", row)}
          rows={filteredRows}
        />
      )}

      <ManagedDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function RolePermissionView(props: {
  canEditRole: boolean;
  canDeleteRole: boolean;
  expandedTree: Record<string, boolean>;
  filteredRoles: RowData[];
  grantDirty: boolean;
  menuTree: TreeNode[];
  onDelete: (row: RowData) => void;
  onEdit: (row: RowData) => void;
  onPanelChange: (panel: PermissionPanel) => void;
  onRoleChange: (roleId: string) => void;
  onSave: () => void;
  onToggleExpand: (id: string) => void;
  onToggleMenu: (node: TreeNode) => void;
  onToggleResource: (id: string) => void;
  panel: PermissionPanel;
  query: string;
  resources: RowData[];
  saving: boolean;
  selectedMenuIds: string[];
  selectedResourceIds: string[];
  selectedRole?: RowData;
  selectedRoleId: string;
}) {
  return (
    <div className="space-y-4">
      <div className="ui-card p-2">
        <div className="grid grid-cols-2 gap-2 sm:w-80">
          <button className={segmentClass(props.panel === "roles")} onClick={() => props.onPanelChange("roles")} type="button">
            <BadgeCheck className="h-4 w-4" />
            角色管理
          </button>
          <button className={segmentClass(props.panel === "grants")} onClick={() => props.onPanelChange("grants")} type="button">
            <FileKey2 className="h-4 w-4" />
            权限配置
          </button>
        </div>
      </div>

      {props.panel === "roles" ? (
        <DataTable
          canDelete={props.canDeleteRole}
          canEdit={props.canEditRole}
          columns={columnsFor("roles")}
          emptyText="暂无角色"
          onDelete={props.onDelete}
          onEdit={props.onEdit}
          rows={props.filteredRoles}
        />
      ) : (
        <section className="ui-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h3 className="ui-panel-title">权限配置</h3>
              <p className="mt-1 text-sm text-slate-500">选择一个角色，然后勾选它可以访问的菜单和接口资源。</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select className="ui-input h-10 sm:w-72" value={props.selectedRoleId} onChange={(event) => props.onRoleChange(event.target.value)}>
                {props.filteredRoles.map((role) => (
                  <option key={stringValue(role, "id")} value={stringValue(role, "id")}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              <button className="ui-btn-primary h-10 px-3" disabled={props.saving || !props.selectedRoleId} onClick={props.onSave} type="button">
                {props.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {props.grantDirty ? "保存变更" : "保存授权"}
              </button>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="border-b border-slate-200/80 p-4 xl:border-b-0 xl:border-r">
              <GrantHeader
                icon={BookOpenCheck}
                title="菜单权限"
                description={props.selectedRole ? `${roleLabel(props.selectedRole)} 已选 ${props.selectedMenuIds.length} 个菜单` : "请先选择角色"}
              />
              <div className="scrollbar-default mt-4 max-h-[520px] overflow-auto rounded-[var(--radius-control-md)] border border-slate-200 bg-slate-50/70 p-2">
                {props.menuTree.length ? (
                  props.menuTree.map((node) => (
                    <GrantTreeRow
                      key={node.id}
                      checkedIds={props.selectedMenuIds}
                      expandedTree={props.expandedTree}
                      labelKey="menuName"
                      node={node}
                      onToggle={props.onToggleMenu}
                      onToggleExpand={props.onToggleExpand}
                    />
                  ))
                ) : (
                  <EmptyState text="暂无菜单可配置" />
                )}
              </div>
            </div>

            <div className="p-4">
              <GrantHeader
                icon={KeyRound}
                title="资源权限"
                description={props.selectedRole ? `${roleLabel(props.selectedRole)} 已选 ${props.selectedResourceIds.length} 个资源` : "请先选择角色"}
              />
              <div className="scrollbar-default mt-4 max-h-[520px] overflow-auto rounded-[var(--radius-control-md)] border border-slate-200 bg-slate-50/70 p-2">
                {props.resources.length ? (
                  props.resources.map((resource) => {
                    const id = stringValue(resource, "id");
                    const checked = props.selectedResourceIds.includes(id);
                    return (
                      <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-control-md)] px-3 py-2 transition ${checked ? "bg-white shadow-sm ring-1 ring-indigo-100" : "hover:bg-white"}`}>
                        <input className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" checked={checked} onChange={() => props.onToggleResource(id)} type="checkbox" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-800">{stringValue(resource, "resourceName") || stringValue(resource, "resourceCode")}</span>
                            <span className="ui-badge bg-white text-slate-600">{stringValue(resource, "method") || "API"}</span>
                          </span>
                          <span className="mt-1 block break-all font-mono text-xs text-slate-500">{stringValue(resource, "path") || stringValue(resource, "resourceCode")}</span>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <EmptyState text="暂无资源可配置" />
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function DataTable(props: {
  canDelete: boolean;
  canEdit: boolean;
  columns: TableColumn[];
  emptyText: string;
  extraAction?: (row: RowData) => React.ReactNode;
  onDelete: (row: RowData) => void;
  onEdit: (row: RowData) => void;
  rows: RowData[];
}) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="scrollbar-default overflow-auto">
        <table className="min-w-full table-fixed text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {props.columns.map((column) => (
                <th key={column.key} className="border-b border-slate-200 px-4 py-3" style={{ width: column.width }}>
                  {column.title}
                </th>
              ))}
              <th className="w-48 border-b border-slate-200 px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.rows.map((row) => (
              <tr key={stringValue(row, "id")} className="bg-white transition hover:bg-indigo-50/35">
                {props.columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-middle text-slate-700">
                    {column.render ? column.render(row) : <CellText value={stringValue(row, column.key)} />}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {props.extraAction?.(row)}
                    {props.canEdit ? (
                      <button className="ui-btn-secondary h-8 px-2 text-xs" onClick={() => props.onEdit(row)} type="button">
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </button>
                    ) : null}
                    {props.canDelete ? (
                      <button className="ui-btn-danger h-8 px-2 text-xs" onClick={() => props.onDelete(row)} type="button">
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!props.rows.length ? <EmptyState text={props.emptyText} /> : null}
    </section>
  );
}

function TreeManagementPanel(props: {
  canDelete: boolean;
  canEdit: boolean;
  columns: TableColumn[];
  emptyText: string;
  expandedTree: Record<string, boolean>;
  nodes: TreeNode[];
  onDelete: (row: RowData) => void;
  onEdit: (row: RowData) => void;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="grid min-w-[860px] grid-cols-[minmax(260px,1.5fr)_repeat(3,minmax(120px,1fr))_160px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.columns.map((column) => <div key={column.key}>{column.title}</div>)}
        <div className="text-right">操作</div>
      </div>
      <div className="scrollbar-default overflow-auto">
        {props.nodes.length ? (
          props.nodes.map((node) => (
            <TreeManagementRow
              key={node.id}
              canDelete={props.canDelete}
              canEdit={props.canEdit}
              columns={props.columns}
              expandedTree={props.expandedTree}
              level={0}
              node={node}
              onDelete={props.onDelete}
              onEdit={props.onEdit}
              onToggleExpand={props.onToggleExpand}
            />
          ))
        ) : (
          <EmptyState text={props.emptyText} />
        )}
      </div>
    </section>
  );
}

function TreeManagementRow(props: {
  canDelete: boolean;
  canEdit: boolean;
  columns: TableColumn[];
  expandedTree: Record<string, boolean>;
  key?: React.Key;
  level: number;
  node: TreeNode;
  onDelete: (row: RowData) => void;
  onEdit: (row: RowData) => void;
  onToggleExpand: (id: string) => void;
}) {
  const hasChildren = Boolean(props.node.children?.length);
  const expanded = hasChildren ? props.expandedTree[props.node.id] !== false : false;
  return (
    <>
      <div className="grid min-w-[860px] grid-cols-[minmax(260px,1.5fr)_repeat(3,minmax(120px,1fr))_160px] items-center border-b border-slate-100 px-4 py-3 text-sm text-slate-700 transition hover:bg-indigo-50/35">
        {props.columns.map((column, index) => (
          <div key={column.key} className="min-w-0">
            {index === 0 ? (
              <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: props.level * 22 }}>
                {hasChildren ? (
                  <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white" onClick={() => props.onToggleExpand(props.node.id)} type="button">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                ) : (
                  <span className="h-7 w-7 shrink-0" />
                )}
                {column.render ? column.render(props.node) : <CellText strong value={stringValue(props.node, column.key)} />}
              </div>
            ) : column.render ? column.render(props.node) : <CellText value={stringValue(props.node, column.key)} />}
          </div>
        ))}
        <div className="flex justify-end gap-2">
          {props.canEdit ? (
            <button className="ui-btn-secondary h-8 px-2 text-xs" onClick={() => props.onEdit(props.node)} type="button">
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </button>
          ) : null}
          {props.canDelete ? (
            <button className="ui-btn-danger h-8 px-2 text-xs" onClick={() => props.onDelete(props.node)} type="button">
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          ) : null}
        </div>
      </div>
      {expanded
        ? props.node.children?.map((child) => (
            <TreeManagementRow
              key={child.id}
              canDelete={props.canDelete}
              canEdit={props.canEdit}
              columns={props.columns}
              expandedTree={props.expandedTree}
              level={props.level + 1}
              node={child}
              onDelete={props.onDelete}
              onEdit={props.onEdit}
              onToggleExpand={props.onToggleExpand}
            />
          ))
        : null}
    </>
  );
}

function ManagedDialog(props: { dialog: DialogState; onClose: () => void }) {
  const [values, setValues] = useState<RowData>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (props.dialog?.type === "form") setValues(props.dialog.data.initialValues);
  }, [props.dialog]);

  if (!props.dialog) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      if (props.dialog?.type === "form") await props.dialog.data.onSubmit(values);
      if (props.dialog?.type === "confirm") await props.dialog.data.onConfirm();
      props.onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const title = props.dialog.data.title;

  return (
    <div className="ui-modal-mask fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="ui-modal-enter w-full max-w-2xl overflow-hidden rounded-[var(--radius-panel)] border border-white/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-950">{title}</h3>
            {props.dialog.type === "form" && props.dialog.data.description ? <p className="mt-1 text-sm text-slate-500">{props.dialog.data.description}</p> : null}
            {props.dialog.type === "confirm" ? <p className="mt-1 text-sm text-slate-500">{props.dialog.data.description}</p> : null}
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control-sm)] text-slate-500 hover:bg-white hover:text-slate-900" onClick={props.onClose} type="button" aria-label="关闭弹窗">
            <X className="h-4 w-4" />
          </button>
        </div>

        {props.dialog.type === "form" ? (
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            {props.dialog.data.fields.map((field) => (
              <FieldControl key={field.name} field={field} value={values[field.name]} onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))} />
            ))}
          </div>
        ) : (
          <div className="px-5 py-5 text-sm leading-6 text-slate-700">该操作会立即生效，请确认无误后继续。</div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button className="ui-btn-secondary" disabled={submitting} onClick={props.onClose} type="button">
            取消
          </button>
          <button className={props.dialog.type === "confirm" ? "ui-btn-danger" : "ui-btn-primary"} disabled={submitting} onClick={() => void submit()} type="button">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {props.dialog.type === "form" ? props.dialog.data.submitText : props.dialog.data.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldControl(props: { field: FormField; key?: React.Key; value: unknown; onChange: (value: string | number | string[]) => void }) {
  const fieldClass = props.field.colSpan === "full" ? "sm:col-span-2" : "";
  const checkedValues = Array.isArray(props.value) ? props.value.map(String) : [];
  return (
    <label className={`block ${fieldClass}`}>
      <span className="ui-label">
        {props.field.label}
        {props.field.required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {props.field.type === "checkboxGroup" ? (
        <div className="scrollbar-default max-h-56 overflow-auto rounded-[var(--radius-control-md)] border border-slate-200 bg-slate-50 p-2">
          {props.field.options?.map((option) => {
            const checked = checkedValues.includes(option.value);
            return (
              <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-control-sm)] px-2 py-1.5 text-sm ${checked ? "bg-white text-indigo-700 shadow-sm" : "text-slate-700 hover:bg-white"}`}>
                <input
                  checked={checked}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  onChange={() => props.onChange(toggleValue(checkedValues, option.value))}
                  type="checkbox"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : props.field.type === "select" ? (
        <select className="ui-input h-10" value={String(props.value ?? "")} onChange={(event) => props.onChange(event.target.value)}>
          {props.field.options?.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : props.field.type === "textarea" ? (
        <textarea className="ui-input min-h-24 resize-y" placeholder={props.field.placeholder} value={String(props.value ?? "")} onChange={(event) => props.onChange(event.target.value)} />
      ) : (
        <input
          className="ui-input h-10"
          placeholder={props.field.placeholder}
          type={props.field.type === "number" ? "number" : props.field.type === "password" ? "password" : "text"}
          value={String(props.value ?? "")}
          onChange={(event) => props.onChange(props.field.type === "number" ? Number(event.target.value || 0) : event.target.value)}
        />
      )}
    </label>
  );
}

function GrantTreeRow(props: {
  checkedIds: string[];
  expandedTree: Record<string, boolean>;
  key?: React.Key;
  labelKey: string;
  level?: number;
  node: TreeNode;
  onToggle: (node: TreeNode) => void;
  onToggleExpand: (id: string) => void;
}) {
  const level = props.level ?? 0;
  const hasChildren = Boolean(props.node.children?.length);
  const expanded = hasChildren ? props.expandedTree[props.node.id] !== false : false;
  const ids = collectTreeIds(props.node);
  const checkedCount = ids.filter((id) => props.checkedIds.includes(id)).length;
  const checked = checkedCount === ids.length;
  const indeterminate = checkedCount > 0 && checkedCount < ids.length;

  return (
    <div>
      <div className={`flex items-start gap-2 rounded-[var(--radius-control-md)] px-2 py-2 transition ${checked || indeterminate ? "bg-white shadow-sm ring-1 ring-indigo-100" : "hover:bg-white"}`} style={{ paddingLeft: level * 20 + 8 }}>
        {hasChildren ? (
          <button className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" onClick={() => props.onToggleExpand(props.node.id)} type="button">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
          <input className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" checked={checked} onChange={() => props.onToggle(props.node)} type="checkbox" />
          <span className="min-w-0">
            <span className="font-semibold text-slate-800">{stringValue(props.node, props.labelKey) || props.node.id}</span>
            <span className="mt-1 block truncate text-xs text-slate-500">{stringValue(props.node, "path") || stringValue(props.node, "permissionCode") || props.node.id}</span>
          </span>
        </label>
      </div>
      {expanded
        ? props.node.children?.map((child) => (
            <GrantTreeRow
              key={child.id}
              checkedIds={props.checkedIds}
              expandedTree={props.expandedTree}
              labelKey={props.labelKey}
              level={level + 1}
              node={child}
              onToggle={props.onToggle}
              onToggleExpand={props.onToggleExpand}
            />
          ))
        : null}
    </div>
  );
}

function GrantHeader(props: { icon: React.ElementType; title: string; description: string }) {
  const Icon = props.icon;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control-md)] bg-indigo-50 text-indigo-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-semibold text-slate-900">{props.title}</div>
        <div className="text-sm text-slate-500">{props.description}</div>
      </div>
    </div>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-control-md)] border border-white/80 bg-white/80 px-3 py-2 shadow-sm">
      <div className="text-[11px] font-semibold text-slate-500">{props.label}</div>
      <div className="mt-0.5 text-lg font-semibold text-slate-950">{props.value}</div>
    </div>
  );
}

function CellText(props: { value: string; strong?: boolean }) {
  return <span className={`block min-w-0 truncate ${props.strong ? "font-semibold text-slate-900" : ""}`}>{props.value || "-"}</span>;
}

function StatusBadge(props: { value: unknown }) {
  const active = String(props.value ?? "1") === "1";
  return <span className={`ui-badge ${active ? "bg-emerald-50 text-emerald-700" : "ui-badge-danger"}`}>{active ? "启用" : "停用"}</span>;
}

function EmptyState(props: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-slate-500">
      <CircleOff className="h-6 w-6 text-slate-300" />
      {props.text}
    </div>
  );
}

function columnsFor(section: AdminSection): TableColumn[] {
  if (section === "users") {
    return [
      { key: "username", title: "账号", render: (row) => <CellText strong value={stringValue(row, "username")} /> },
      { key: "nickname", title: "姓名/昵称" },
      { key: "departmentName", title: "所属组织" },
      { key: "email", title: "邮箱" },
      { key: "phone", title: "手机号" },
      { key: "dataScope", title: "数据范围", render: (row) => <span className="ui-badge bg-slate-50 text-slate-700">{DATA_SCOPE_LABEL[normalizeDataScope(stringValue(row, "dataScope"))]}</span> },
      { key: "status", title: "状态", render: (row) => <StatusBadge value={row.status} /> },
    ];
  }
  if (section === "resources") {
    return [
      { key: "resourceName", title: "资源名称", render: (row) => <CellText strong value={stringValue(row, "resourceName")} /> },
      { key: "resourceCode", title: "资源编码" },
      { key: "method", title: "方法", render: (row) => <span className="ui-badge bg-slate-50 text-slate-700">{stringValue(row, "method") || "GET"}</span> },
      { key: "path", title: "路径", render: (row) => <span className="block break-all font-mono text-xs text-slate-600">{stringValue(row, "path") || "-"}</span> },
      { key: "matchType", title: "匹配" },
      { key: "priority", title: "优先级" },
      { key: "status", title: "状态", render: (row) => <StatusBadge value={row.status} /> },
    ];
  }
  return [
    { key: "roleCode", title: "角色编码", render: (row) => <CellText strong value={stringValue(row, "roleCode")} /> },
    { key: "roleName", title: "角色名称" },
    { key: "roleType", title: "类型", render: (row) => <span className="ui-badge bg-slate-50 text-slate-700">{ROLE_TYPE_LABEL[stringValue(row, "roleType")] || stringValue(row, "roleType")}</span> },
    { key: "sortOrder", title: "排序" },
    { key: "remark", title: "备注" },
    { key: "status", title: "状态", render: (row) => <StatusBadge value={row.status} /> },
  ];
}

function departmentColumns(): TableColumn[] {
  return [
    { key: "deptName", title: "组织名称", render: (row) => <CellText strong value={stringValue(row, "deptName")} /> },
    { key: "deptCode", title: "组织编码" },
    { key: "leader", title: "负责人" },
    { key: "phone", title: "电话" },
  ];
}

function menuColumns(): TableColumn[] {
  return [
    { key: "menuName", title: "菜单名称", render: (row) => <CellText strong value={stringValue(row, "menuName")} /> },
    { key: "path", title: "路径" },
    { key: "permissionCode", title: "权限码" },
    { key: "sortOrder", title: "排序" },
  ];
}

function fieldsFor(section: AdminSection, options: {
  departmentOptions: Array<{ value: string; label: string }>;
  menuOptions: Array<{ value: string; label: string }>;
  parentDepartmentOptions: Array<{ value: string; label: string }>;
  parentMenuOptions: Array<{ value: string; label: string }>;
}): FormField[] {
  if (section === "users") {
    return [
      { name: "username", label: "账号", required: true },
      { name: "nickname", label: "姓名/昵称" },
      { name: "departmentId", label: "所属组织", type: "select", options: options.departmentOptions },
      { name: "email", label: "邮箱" },
      { name: "phone", label: "手机号" },
      { name: "password", label: "密码", type: "password", placeholder: "新增默认 Eflow@123456，编辑留空不修改" },
      { name: "remark", label: "备注", type: "textarea", colSpan: "full" },
    ];
  }
  if (section === "departments") {
    return [
      { name: "parentId", label: "上级组织", type: "select", options: options.parentDepartmentOptions },
      { name: "deptCode", label: "组织编码", required: true },
      { name: "deptName", label: "组织名称", required: true },
      { name: "leader", label: "负责人" },
      { name: "phone", label: "电话" },
      { name: "sortOrder", label: "排序", type: "number" },
      { name: "remark", label: "备注", type: "textarea", colSpan: "full" },
    ];
  }
  if (section === "menus") {
    return [
      { name: "parentId", label: "上级菜单", type: "select", options: options.parentMenuOptions },
      { name: "menuName", label: "菜单名称", required: true },
      { name: "path", label: "路径", placeholder: "/settings/rbac/users" },
      { name: "component", label: "组件标识" },
      { name: "icon", label: "图标" },
      { name: "permissionCode", label: "权限码", placeholder: "system:user:view" },
      { name: "sortOrder", label: "排序", type: "number" },
      { name: "remark", label: "备注", type: "textarea", colSpan: "full" },
    ];
  }
  if (section === "resources") {
    return [
      { name: "menuId", label: "关联菜单", type: "select", options: options.menuOptions },
      { name: "resourceName", label: "资源名称", required: true },
      { name: "resourceCode", label: "资源编码", required: true, placeholder: "system:user:view" },
      { name: "method", label: "请求方法", type: "select", options: HTTP_METHODS.map((item) => ({ value: item, label: item })) },
      { name: "path", label: "接口路径", required: true, placeholder: "/api/rbac/users" },
      { name: "resourceType", label: "资源类型", type: "select", options: RESOURCE_TYPES.map((item) => ({ value: item, label: item })) },
      { name: "matchType", label: "匹配方式", type: "select", options: MATCH_TYPES.map((item) => ({ value: item, label: item })) },
      { name: "priority", label: "优先级", type: "number" },
      { name: "remark", label: "备注", type: "textarea", colSpan: "full" },
    ];
  }
  return [
    { name: "roleCode", label: "角色编码", required: true },
    { name: "roleName", label: "角色名称", required: true },
    { name: "roleType", label: "角色类型", type: "select", options: Object.entries(ROLE_TYPE_LABEL).map(([value, label]) => ({ value, label })) },
    { name: "sortOrder", label: "排序", type: "number" },
    { name: "remark", label: "备注", type: "textarea", colSpan: "full" },
  ];
}

function initialValuesFor(section: AdminSection, mode: FormMode, row?: RowData): RowData {
  const source = row ?? {};
  if (section === "users") {
    return {
      username: stringValue(source, "username"),
      nickname: stringValue(source, "nickname"),
      departmentId: stringValue(source, "departmentId"),
      email: stringValue(source, "email"),
      phone: stringValue(source, "phone"),
      password: mode === "create" ? "Eflow@123456" : "",
      remark: stringValue(source, "remark"),
    };
  }
  if (section === "departments") {
    return {
      parentId: stringValue(source, "parentId"),
      deptCode: stringValue(source, "deptCode"),
      deptName: stringValue(source, "deptName"),
      leader: stringValue(source, "leader"),
      phone: stringValue(source, "phone"),
      sortOrder: numberValue(source, "sortOrder"),
      remark: stringValue(source, "remark"),
    };
  }
  if (section === "menus") {
    return {
      parentId: stringValue(source, "parentId"),
      menuName: stringValue(source, "menuName"),
      path: stringValue(source, "path"),
      component: stringValue(source, "component"),
      icon: stringValue(source, "icon"),
      permissionCode: stringValue(source, "permissionCode"),
      sortOrder: numberValue(source, "sortOrder"),
      remark: stringValue(source, "remark"),
    };
  }
  if (section === "resources") {
    return {
      menuId: stringValue(source, "menuId"),
      resourceName: stringValue(source, "resourceName"),
      resourceCode: stringValue(source, "resourceCode"),
      method: stringValue(source, "method") || "GET",
      path: stringValue(source, "path"),
      resourceType: stringValue(source, "resourceType") || "API",
      matchType: stringValue(source, "matchType") || "EXACT",
      priority: numberValue(source, "priority"),
      remark: stringValue(source, "remark"),
    };
  }
  return {
    roleCode: stringValue(source, "roleCode"),
    roleName: stringValue(source, "roleName"),
    roleType: stringValue(source, "roleType") || "NORMAL",
    sortOrder: numberValue(source, "sortOrder"),
    remark: stringValue(source, "remark"),
  };
}

function cleanPayload(section: AdminSection, values: RowData): RowData {
  const payload = { ...values };
  if (section === "users" && !stringValue(payload, "password")) delete payload.password;
  for (const key of ["departmentId", "parentId", "menuId"]) {
    if (payload[key] === "") payload[key] = null;
  }
  return payload;
}

function getRows(section: AdminSection, state: { users: RowData[]; departments: RowData[]; menus: RowData[]; resources: RowData[]; roles: RowData[] }) {
  if (section === "users") return state.users;
  if (section === "departments") return state.departments;
  if (section === "menus") return state.menus;
  if (section === "resources") return state.resources;
  return state.roles;
}

function stringValue(row: RowData | undefined, key: string) {
  const value = row?.[key];
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(row: RowData, key: string) {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function filterRows(rows: RowData[], query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return rows;
  return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(keyword)));
}

function buildTreeFromRows(rows: RowData[]): TreeNode[] {
  return rows.map((row) => ({ ...row, id: stringValue(row, "id"), children: [] }));
}

function toTreeOptions(nodes: TreeNode[], labelKey: string) {
  const options: Array<{ value: string; label: string }> = [];
  const walk = (items: TreeNode[], level: number) => {
    items.forEach((item) => {
      options.push({ value: item.id, label: `${"　".repeat(level)}${stringValue(item, labelKey) || item.id}` });
      if (item.children?.length) walk(item.children, level + 1);
    });
  };
  walk(nodes, 0);
  return options;
}

function buildExpandState(nodes: TreeNode[]) {
  const state: Record<string, boolean> = {};
  const walk = (items: TreeNode[]) => {
    items.forEach((item) => {
      if (item.children?.length) {
        state[item.id] = true;
        walk(item.children);
      }
    });
  };
  walk(nodes);
  return state;
}

function collectTreeIds(node: TreeNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectTreeIds)];
}

function toggleValue(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function normalizeDataScope(value: string): DataScope {
  if (value === "DEPT" || value === "DEPT_AND_SUB" || value === "ALL") return value;
  return "SELF";
}

function displayName(section: AdminSection, row: RowData) {
  if (section === "users") return stringValue(row, "nickname") || stringValue(row, "username") || stringValue(row, "id");
  if (section === "departments") return stringValue(row, "deptName") || stringValue(row, "deptCode") || stringValue(row, "id");
  if (section === "menus") return stringValue(row, "menuName") || stringValue(row, "path") || stringValue(row, "id");
  if (section === "resources") return stringValue(row, "resourceName") || stringValue(row, "resourceCode") || stringValue(row, "id");
  return stringValue(row, "roleName") || stringValue(row, "roleCode") || stringValue(row, "id");
}

function roleLabel(row: RowData) {
  const code = stringValue(row, "roleCode");
  const name = stringValue(row, "roleName") || code || stringValue(row, "id");
  return code && code !== name ? `${name} (${code})` : name;
}

function segmentClass(active: boolean) {
  return `inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control-md)] text-sm font-semibold transition ${
    active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
  }`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
