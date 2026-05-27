import React, { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { cn } from "./lib/utils.ts";
import { AppHeader } from "./components/AppHeader.tsx";
import type { AppViewMode } from "./components/RoleSwitcher.tsx";
import { isRbacSubMenuPath, resolveMenuIcon } from "./lib/menuIcons.ts";
import { readAppUrlParams, syncAppUrlParams, type RbacSection } from "./lib/urlParams.ts";
import { DashboardView } from "./components/views/DashboardView.tsx";
import { ModelsView } from "./components/views/ModelsView.tsx";
import { SkillsView } from "./components/views/SkillsView.tsx";
import { DataView } from "./components/views/DataView.tsx";
import { NotificationsView } from "./components/views/NotificationsView.tsx";
import { AdminRbacConsole } from "./components/views/AdminRbacConsole.tsx";
import { AgentsView } from "./components/views/AgentsView.tsx";
import { TaskWorkbench } from "./components/views/TaskWorkbench.tsx";
import { WorkbenchView } from "./components/views/WorkbenchView.tsx";
import { AnalyticsView } from "./components/views/AnalyticsView.tsx";
import { RunsView } from "./components/views/RunsView.tsx";
import { ToolsView } from "./components/views/ToolsView.tsx";
import { InterfaceMonitorView } from "./components/views/InterfaceMonitorView.tsx";
import { KnowledgeBaseView } from "./components/views/KnowledgeBaseView.tsx";
import { WorkflowsView } from "./components/views/WorkflowsView.tsx";
import type { WorkbenchTab } from "./components/views/workbench/constants.ts";
import { useAuth } from "./auth.tsx";

type Tab = string;
type SceneTab = "sceneAttribution" | "sceneCases";

type MenuRouteNode = {
  id: string;
  menuName?: string;
  path?: string;
  component?: string;
  icon?: string;
  children?: MenuRouteNode[];
};

type NavItem = { id: Tab; icon: React.ElementType; label: string };
type MenuNavNode = {
  key: string;
  label: string;
  icon: React.ElementType;
  tab?: Tab;
  children?: MenuNavNode[];
};

const fallbackHeaderTitles: Record<string, string> = {
  dashboard: "运营大盘",
  agents: "Agent 配置",
  workflows: "Workflow 管理",
  models: "模型配置与监控",
  skills: "技能管理",
  knowledge: "知识库管理",
  tools: "Tool 注册中心",
  data: "数据源配置",
  interfaceMonitor: "接口监控",
  workbench: "工作台",
  analytics: "运营分析",
  sceneAttribution: "对账差异清单",
  sceneCases: "案例库",
  runs: "Agent 执行追踪",
  notifications: "通知配置",
  rbac: "系统权限与操作审计",
};

const PATH_TAB_MAP: Record<string, Tab> = {
  "/": "dashboard",
  "/dashboard": "dashboard",
  "/agents": "agents",
  "/workflows": "workflows",
  "/models": "models",
  "/skills": "skills",
  "/knowledge": "knowledge",
  "/tools": "tools",
  "/data": "data",
  "/connectors": "data",
  "/monitor/interfaces": "interfaceMonitor",
  "/interface-monitor": "interfaceMonitor",
  "/notifications": "notifications",
  "/settings/rbac": "rbac",
  "/settings/rbac/users": "rbac",
  "/settings/rbac/departments": "rbac",
  "/settings/rbac/menus": "rbac",
  "/settings/rbac/resources": "rbac",
  "/settings/rbac/roles": "rbac",
  "/workbench": "workbench",
  "/analytics": "analytics",
  "/runs": "runs",
  "/scene/attribution": "sceneAttribution",
  "/scene/cases": "sceneCases",
};

const COMPONENT_TAB_MAP: Record<string, Tab> = {
  AdminRbacConsole: "rbac",
  DashboardView: "dashboard",
  AgentsView: "agents",
  WorkflowsView: "workflows",
  ModelsView: "models",
  SkillsView: "skills",
  KnowledgeBaseView: "knowledge",
  ToolsView: "tools",
  DataView: "data",
  InterfaceMonitorView: "interfaceMonitor",
  NotificationsView: "notifications",
  RunsView: "runs",
  WorkbenchView: "workbench",
  AnalyticsView: "analytics",
  TaskWorkbench: "sceneAttribution",
};

const VIEW_MODE_KEY = "tai-agent-view-mode";

function defaultTabForMode(mode: AppViewMode): Tab {
  if (mode === "admin") return "dashboard";
  return "workbench";
}

function roleLabel(mode: AppViewMode) {
  if (mode === "admin") return "管理员后台";
  if (mode === "finance") return "财务前台";
  return `${mode.toUpperCase()} 业务处理`;
}

function isSceneTab(tab: Tab): tab is SceneTab {
  return tab === "sceneAttribution" || tab === "sceneCases";
}

const sceneTabToView: Record<SceneTab, WorkbenchTab> = {
  sceneAttribution: "todo",
  sceneCases: "cases",
};

export default function App() {
  const { accessToken } = useAuth();
  const urlParams = readAppUrlParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => defaultTabForMode(urlParams.view ?? "finance"));
  const [viewMode, setViewMode] = useState<AppViewMode>(() => {
    if (urlParams.view) return urlParams.view;
    const saved = localStorage.getItem(VIEW_MODE_KEY);
    return saved === "admin" || saved === "sap" || saved === "dms" || saved === "finance" ? saved : "finance";
  });
  const [routeMenus, setRouteMenus] = useState<MenuRouteNode[]>([]);
  const [menuLoadError, setMenuLoadError] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    syncAppUrlParams({ view: viewMode });
  }, [viewMode]);

  useEffect(() => {
    setActiveTab(defaultTabForMode(viewMode));
  }, [viewMode]);

  useEffect(() => {
    const loadMenus = async () => {
      if (!accessToken) return;
      setMenuLoadError(false);
      try {
        const resp = await fetch("/api/rbac/menus/routes", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const payload = await resp.json();
        if (!resp.ok || !payload?.success || !Array.isArray(payload.data)) {
          throw new Error(payload?.message || "load routes failed");
        }
        setRouteMenus(payload.data as MenuRouteNode[]);
      } catch {
        setMenuLoadError(true);
        setRouteMenus([]);
      }
    };
    void loadMenus();
  }, [accessToken]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab: Tab; billNo?: string | null }>).detail;
      if (detail?.tab) {
        syncAppUrlParams({ billNo: detail.billNo ?? null, workbenchTab: null });
        setActiveTab(detail.tab);
      }
    };
    window.addEventListener("agent-hub-tab-switch", handler);
    return () => window.removeEventListener("agent-hub-tab-switch", handler);
  }, []);

  const navigateTab = (tab: Tab) => {
    syncAppUrlParams({
      billNo: null,
      workbenchTab: null,
      rbacSection: tab === "rbac" ? urlParams.rbacSection ?? "users" : null,
    });
    setActiveTab(tab);
  };

  const switchViewMode = (mode: AppViewMode) => {
    setViewMode(mode);
    syncAppUrlParams({ view: mode });
    setActiveTab(defaultTabForMode(mode));
  };

  const navTree = useMemo<MenuNavNode[]>(() => {
    if (!routeMenus.length) {
      return [
        { key: "default-dashboard", label: "运营大盘", icon: resolveMenuIcon("BarChartOutlined"), tab: "dashboard" },
        { key: "default-workbench", label: "工作台", icon: resolveMenuIcon("RobotOutlined"), tab: "workbench" },
        { key: "default-rbac-root", label: "系统权限与操作审计", icon: resolveMenuIcon("ShieldCheckOutlined"), tab: "rbac" },
      ];
    }

    return routeMenus
      .map((node) => toNavNode(node))
      .filter((node): node is MenuNavNode => Boolean(node));
  }, [routeMenus]);

  const availableTabs = useMemo(() => {
    const set = new Set<Tab>();
    collectTabs(navTree).forEach((tab) => set.add(tab));
    return set;
  }, [navTree]);

  useEffect(() => {
    setExpandedKeys((prev) => {
      const next = { ...prev };
      ensureExpandedForActive(navTree, activeTab, next);
      return next;
    });
  }, [navTree, activeTab]);

  useEffect(() => {
    const legacyRbac = activeTab.startsWith("rbac") && activeTab !== "rbac";
    if (legacyRbac) {
      const legacySection: Record<string, RbacSection> = {
        rbacUsers: "users",
        rbacDepartments: "departments",
        rbacMenus: "menus",
        rbacResources: "resources",
        rbacRoles: "roles",
      };
      const section = legacySection[activeTab] ?? "users";
      syncAppUrlParams({ rbacSection: section });
      setActiveTab("rbac");
      return;
    }
    if (availableTabs.size > 0 && !availableTabs.has(activeTab)) {
      const first = collectTabs(navTree)[0];
      if (first) setActiveTab(first);
    }
  }, [activeTab, availableTabs, navTree]);

  const activeMenuLabel = useMemo(() => {
    const found = findLabelByTab(navTree, activeTab);
    if (found) return found;
    return fallbackHeaderTitles[activeTab] || activeTab;
  }, [activeTab, navTree]);

  const sceneInitialView = isSceneTab(activeTab) ? sceneTabToView[activeTab] : undefined;

  const rbacSection: RbacSection = activeTab === "rbac" ? urlParams.rbacSection ?? "users" : "users";

  const headerBreadcrumbs = useMemo(() => {
    const root = viewMode === "admin" ? "管理后台" : roleLabel(viewMode);
    return [root, activeMenuLabel];
  }, [viewMode, activeMenuLabel]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc] font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      <aside className="ui-sidebar z-40 flex min-h-0 w-64 shrink-0 flex-col border-r border-slate-800/80 shadow-2xl">
        <div className="mb-4 mt-2 flex h-16 items-center border-b border-slate-800/50 px-6">
          <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-black text-white shadow-lg shadow-indigo-500/20">
            A
          </div>
          <span className="bg-gradient-to-r from-indigo-200 to-white bg-clip-text text-lg font-bold tracking-wider text-transparent">
            Agent 智能中台
          </span>
        </div>

        <nav className="scrollbar-hide min-h-0 flex-1 overflow-y-auto py-2">
          <ul className="m-0 list-none p-0">
            {navTree.map((node) => (
              <React.Fragment key={node.key}>
                <TreeMenuItem
                  node={node}
                  activeTab={activeTab}
                  expandedKeys={expandedKeys}
                  setExpandedKeys={setExpandedKeys}
                  navigateTab={navigateTab}
                  depth={0}
                />
              </React.Fragment>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <AppHeader breadcrumbs={headerBreadcrumbs} viewMode={viewMode} onSwitchRole={switchViewMode} />
        {menuLoadError ? (
          <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-8 py-1.5 text-xs text-amber-700">
            菜单加载失败，已使用降级菜单
          </div>
        ) : null}

        <div className="scrollbar-default ui-page-enter min-w-0 flex-1 overflow-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && <DashboardView key="dashboard" />}
            {activeTab === "agents" && <AgentsView key="agents" />}
            {activeTab === "workflows" && <WorkflowsView key="workflows" />}
            {activeTab === "models" && <ModelsView key="models" />}
            {activeTab === "skills" && <SkillsView key="skills" />}
            {activeTab === "knowledge" && <KnowledgeBaseView key="knowledge" />}
            {activeTab === "tools" && <ToolsView key="tools" />}
            {activeTab === "data" && <DataView key="data" />}
            {activeTab === "interfaceMonitor" && <InterfaceMonitorView key="interfaceMonitor" />}
            {activeTab === "notifications" && <NotificationsView key="notifications" />}
            {activeTab === "rbac" && (
              <div key={rbacSection} className="h-full">
                <AdminRbacConsole initialSection={rbacSection} />
              </div>
            )}
            {activeTab === "runs" && <RunsView key="runs" />}
            {activeTab === "workbench" && <div key="workbench" className="h-full"><WorkbenchView roleMode={viewMode} /></div>}
            {activeTab === "analytics" && <div key="analytics" className="h-full"><AnalyticsView roleMode={viewMode} /></div>}
            {isSceneTab(activeTab) && sceneInitialView && (
              <div key={activeTab} className="h-full">
                <TaskWorkbench
                  roleMode={viewMode}
                  initialTab={sceneInitialView}
                  initialBillNo={urlParams.billNo}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

type TreeMenuItemProps = {
  node: MenuNavNode;
  activeTab: Tab;
  expandedKeys: Record<string, boolean>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  navigateTab: (tab: Tab) => void;
  depth: number;
};

function TreeMenuItem(props: TreeMenuItemProps) {
  const { node, activeTab, expandedKeys, setExpandedKeys, navigateTab, depth } = props;
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expandedKeys[node.key] ?? depth === 0;
  const isSelfActive = Boolean(node.tab && node.tab === activeTab);
  const isParentActive = hasChildren ? hasActiveDescendant(node.children || [], activeTab) : false;
  const paddingLeft = depth === 0 ? "1rem" : `${depth * 1 + 1.5}rem`;

  const onClick = () => {
    if (hasChildren) {
      setExpandedKeys((prev) => ({ ...prev, [node.key]: !isExpanded }));
      return;
    }
    if (node.tab) navigateTab(node.tab);
  };

  return (
    <li className="relative mb-0.5 list-none select-none">
      <button
        type="button"
        onClick={onClick}
        style={{ paddingLeft }}
        className={cn(
          "group mx-3 flex w-[calc(100%-1.5rem)] cursor-pointer items-center justify-between rounded-xl py-2.5 pr-4 text-left transition-all duration-200 ease-out",
          isSelfActive && !hasChildren
            ? "translate-x-1 bg-gradient-to-r from-indigo-500 to-purple-600 font-medium text-white shadow-lg shadow-indigo-500/30"
            : "text-slate-400 hover:bg-slate-800/80 hover:text-white",
          isParentActive && hasChildren && depth > 0 && "text-indigo-300",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {depth === 0 ? (
            <node.icon
              className={cn(
                "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                isSelfActive || isParentActive ? "text-indigo-400" : "text-slate-500",
              )}
            />
          ) : (
            <span
              className={cn(
                "shrink-0 rounded-full transition-all",
                depth === 1 ? "h-1.5 w-1.5" : "h-1 w-1",
                isSelfActive ? "bg-white shadow-[0_0_5px_#fff]" : "bg-slate-600 group-hover:bg-indigo-400",
              )}
            />
          )}
          <span className={cn("truncate tracking-wide", depth === 0 ? "text-[14px] font-medium" : "text-[13px]")}>
            {node.label}
          </span>
          {node.tab === "interfaceMonitor" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              <Bell className="h-3 w-3" />
              2
            </span>
          )}
        </div>
        {hasChildren && (
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-slate-600 transition-transform duration-300",
              isExpanded && "rotate-90 text-indigo-400",
            )}
          />
        )}
      </button>
      {hasChildren && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <ul className="relative overflow-hidden">
            {depth > 0 && <div className="absolute bottom-0 left-[1.8rem] top-0 w-px bg-slate-800/50" />}
            <div className="py-1">
              {node.children?.map((child) => (
                <React.Fragment key={child.key}>
                  <TreeMenuItem
                    node={child}
                    activeTab={activeTab}
                    expandedKeys={expandedKeys}
                    setExpandedKeys={setExpandedKeys}
                    navigateTab={navigateTab}
                    depth={depth + 1}
                  />
                </React.Fragment>
              ))}
            </div>
          </ul>
        </div>
      )}
    </li>
  );
}

function resolveTabFromMenu(node: MenuRouteNode): Tab | null {
  const path = (node.path || "").trim();
  if (path.startsWith("/settings/rbac")) return "rbac";
  if (path && PATH_TAB_MAP[path]) return PATH_TAB_MAP[path];
  const component = (node.component || "").trim();
  if (component && COMPONENT_TAB_MAP[component]) return COMPONENT_TAB_MAP[component];
  return null;
}

function toNavNode(node: MenuRouteNode): MenuNavNode | null {
  if (isRbacSubMenuPath(node.path)) return null;

  const children = (node.children || [])
    .map((child) => toNavNode(child))
    .filter((child): child is MenuNavNode => Boolean(child));
  const tab = resolveTabFromMenu(node);
  if (!tab && children.length === 0) return null;
  return {
    key: node.id || `${node.path || "node"}-${node.menuName || ""}`,
    label: node.menuName || (tab ? fallbackHeaderTitles[tab] || tab : "菜单"),
    icon: resolveMenuIcon(node.icon),
    tab: tab || undefined,
    children: children.length ? children : undefined,
  };
}

function collectTabs(nodes: MenuNavNode[]): Tab[] {
  const out: Tab[] = [];
  const walk = (list: MenuNavNode[]) => {
    list.forEach((node) => {
      if (node.tab) out.push(node.tab);
      if (node.children?.length) walk(node.children);
    });
  };
  walk(nodes);
  return Array.from(new Set(out));
}

function hasActiveDescendant(nodes: MenuNavNode[], activeTab: Tab): boolean {
  return nodes.some((node) => node.tab === activeTab || (node.children?.length ? hasActiveDescendant(node.children, activeTab) : false));
}

function ensureExpandedForActive(nodes: MenuNavNode[], activeTab: Tab, expanded: Record<string, boolean>): boolean {
  let contains = false;
  nodes.forEach((node) => {
    const self = node.tab === activeTab;
    const childContains = node.children?.length ? ensureExpandedForActive(node.children, activeTab, expanded) : false;
    if (childContains) expanded[node.key] = true;
    if (self || childContains) contains = true;
  });
  return contains;
}

function findLabelByTab(nodes: MenuNavNode[], tab: Tab): string | null {
  for (const node of nodes) {
    if (node.tab === tab) return node.label;
    if (node.children?.length) {
      const found = findLabelByTab(node.children, tab);
      if (found) return found;
    }
  }
  return null;
}
