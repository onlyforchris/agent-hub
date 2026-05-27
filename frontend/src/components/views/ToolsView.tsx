import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Braces,
  ChevronRight,
  Cpu,
  Database,
  FileText,
  Info,
  Layers,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Scale,
  Search,
  Server,
  Shield,
  Trash2,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/src/lib/utils.ts";
import {
  createToolRegistry,
  deleteToolRegistry,
  fetchRuntimeToolCatalog,
  fetchToolRegistry,
  parseJsonSchema,
  reloadToolRegistry,
  testToolRegistry,
  updateToolRegistry,
  type RuntimeToolCatalogItem,
  type ToolRegistryForm,
  type ToolRegistryRow,
  type ToolTestResult,
} from "@/src/api/tools.ts";
import {
  TOOL_CATEGORIES,
  TOOL_CATEGORY_DESCRIPTIONS,
  TOOL_CATEGORY_LABELS,
  type ToolCategory,
} from "@/src/api/toolCategories.ts";
import {
  UiBadge,
  UiButton,
  UiPanelCard,
  UiSectionHeading,
  UiTabs,
  type TabItem,
} from "@/src/components/ui/primitives.tsx";
import { useAuth } from "@/src/auth.tsx";

type MainTab = "registry" | "runtime";
type DrawerTab = "overview" | "test" | "schema";

const MAIN_TABS: TabItem[] = [
  { id: "registry", label: "能力目录", icon: <Layers className="h-4 w-4" /> },
  { id: "runtime", label: "运行时 Handler", icon: <Server className="h-4 w-4" /> },
];

const DRAWER_TABS: TabItem[] = [
  { id: "overview", label: "概览", icon: <Info className="h-4 w-4" /> },
  { id: "test", label: "测试", icon: <Play className="h-4 w-4" /> },
  { id: "schema", label: "Schema", icon: <Braces className="h-4 w-4" /> },
];

const categoryLabels: Record<string, string> = {
  all: "全部",
  ...TOOL_CATEGORY_LABELS,
};

const categoryStyles: Record<ToolCategory, string> = {
  data_query: "bg-blue-50 text-blue-700 ring-blue-500/20",
  rule: "bg-emerald-50 text-emerald-700 ring-emerald-500/20",
  compute: "bg-violet-50 text-violet-700 ring-violet-500/20",
  template: "bg-amber-50 text-amber-700 ring-amber-500/20",
  notify: "bg-rose-50 text-rose-700 ring-rose-500/20",
};

const runtimeLabels: Record<string, string> = {
  JAVA_BEAN: "Java 内置",
  GROOVY: "Groovy 脚本",
  CLI: "CLI",
};

const categoryIcons: Record<ToolCategory, React.ReactNode> = {
  data_query: <Database className="h-5 w-5" />,
  rule: <Scale className="h-5 w-5" />,
  compute: <Cpu className="h-5 w-5" />,
  template: <FileText className="h-5 w-5" />,
  notify: <Bell className="h-5 w-5" />,
};

const categoryAccent: Record<ToolCategory, string> = {
  data_query: "from-blue-500 to-cyan-500",
  rule: "from-emerald-500 to-teal-500",
  compute: "from-violet-500 to-purple-600",
  template: "from-amber-500 to-orange-500",
  notify: "from-rose-500 to-pink-500",
};

const sideEffectLabels: Record<string, string> = {
  none: "只读",
  notify: "发送通知",
  write: "写入业务系统",
};

const sensitivityLabels: Record<string, string> = {
  public: "公开数据",
  internal: "内部数据",
  internal_finance: "财务内部",
  restricted: "受限数据",
};

const SANDBOX_HINT =
  "脚本在 Groovy 沙箱中执行（与 Java 同进程）。禁止文件 IO、反射与启动外部进程；单次超时 3 秒。带写入或通知副作用的 Tool 须标注 side_effect 并单独审批。";

const emptyForm: ToolRegistryForm = {
  toolKey: "",
  toolName: "",
  category: "compute",
  description: "",
  runtimeKind: "GROOVY",
  scriptContent: "",
  inputSchema: '{"type":"object","properties":{"bindings":{"type":"object"}}}',
  outputSchema: '{"type":"object"}',
  connector: "sandbox_runtime",
  dataSensitivity: "internal",
  sideEffect: "none",
  permissionCode: "LEVEL_2",
  version: "1.0.0",
  owner: "",
  isEnabled: 1,
  sortOrder: 100,
};

function formatSchema(schema?: string) {
  return JSON.stringify(parseJsonSchema(schema), null, 2);
}

function ToolMetaCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white/90 p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="text-indigo-500">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function defaultTestParams(tool: ToolRegistryRow): string {
  const samples: Record<string, Record<string, unknown>> = {
    "template.render_text_summary": {
      bindings: { title: "周报", bullets: ["收入同比 +12%", "回款进度正常"] },
    },
    "rule.eval_amount_threshold": { bindings: { amount: 12000, threshold: 10000 } },
    "compute.aggregate_sum": { bindings: { values: [100, 200, 50] } },
    "notify.format_message": {
      bindings: { recipient: "finance-user", subject: "对账提醒", body: "存在 3 笔待处理差异" },
    },
    "query.filter.by_field": {
      bindings: {
        items: [
          { id: 1, status: "ok" },
          { id: 2, status: "pending" },
        ],
        field: "status",
        expect: "ok",
      },
    },
    "sandbox.script.eval": {
      script: 'return [message: "hello", name: bindings?.name]',
      bindings: { name: "demo" },
    },
  };
  const body = samples[tool.toolKey] ?? {
    bindings: { rows: [{ id: 1, name: "示例", amount: 100 }] },
  };
  return JSON.stringify(body, null, 2);
}

export function ToolsView() {
  const { accessToken } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>("registry");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [tools, setTools] = useState<ToolRegistryRow[]>([]);
  const [runtimeCatalog, setRuntimeCatalog] = useState<RuntimeToolCatalogItem[]>([]);
  const [selected, setSelected] = useState<ToolRegistryRow | null>(null);
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [runtimeKeyword, setRuntimeKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ToolRegistryForm>(emptyForm);
  const [testParams, setTestParams] = useState("{}");
  const [testResult, setTestResult] = useState<ToolTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const registryKeys = useMemo(() => new Set(tools.map((t) => t.toolKey)), [tools]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [registry, catalog] = await Promise.all([
        fetchToolRegistry(accessToken),
        fetchRuntimeToolCatalog(accessToken),
      ]);
      setTools(registry);
      setRuntimeCatalog(catalog);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    return tools.filter((tool) => {
      if (category !== "all" && tool.category !== category) return false;
      const text = `${tool.toolKey} ${tool.toolName} ${tool.description ?? ""}`;
      return !keyword || text.toLowerCase().includes(keyword.toLowerCase());
    });
  }, [category, keyword, tools]);

  const filteredRuntime = useMemo(() => {
    if (!runtimeKeyword.trim()) return runtimeCatalog;
    const q = runtimeKeyword.toLowerCase();
    return runtimeCatalog.filter(
      (item) =>
        item.toolKey.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    );
  }, [runtimeCatalog, runtimeKeyword]);

  const metrics = useMemo(() => {
    const byCategory = Object.fromEntries(
      TOOL_CATEGORIES.map((c) => [c, tools.filter((t) => t.category === c).length]),
    ) as Record<ToolCategory, number>;
    return {
      total: tools.length,
      groovy: tools.filter((t) => t.runtimeKind === "GROOVY").length,
      javaBean: tools.filter((t) => t.runtimeKind === "JAVA_BEAN").length,
      runtimeHandlers: runtimeCatalog.length,
      byCategory,
    };
  }, [tools, runtimeCatalog]);

  const selectTool = (tool: ToolRegistryRow) => {
    setSelected(tool);
    setDrawerTab("overview");
    setTestParams(defaultTestParams(tool));
    setTestResult(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (tool: ToolRegistryRow) => {
    setEditingId(tool.id);
    setForm({
      toolKey: tool.toolKey,
      toolName: tool.toolName,
      category: tool.category,
      description: tool.description ?? "",
      runtimeKind: tool.runtimeKind,
      scriptContent: tool.scriptContent ?? "",
      inputSchema: tool.inputSchema ?? emptyForm.inputSchema,
      outputSchema: tool.outputSchema ?? emptyForm.outputSchema,
      connector: tool.connector,
      dataSensitivity: tool.dataSensitivity,
      sideEffect: tool.sideEffect,
      permissionCode: tool.permissionCode,
      version: tool.version,
      owner: tool.owner ?? "",
      isEnabled: tool.isEnabled,
      sortOrder: tool.sortOrder,
      remark: tool.remark,
    });
    setEditorOpen(true);
  };

  const saveForm = async () => {
    try {
      if (editingId) {
        await updateToolRegistry(accessToken, editingId, form);
      } else {
        await createToolRegistry(accessToken, form);
      }
      setEditorOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  const removeTool = async (id: string) => {
    if (!window.confirm("确认删除该 Tool？")) return;
    try {
      await deleteToolRegistry(accessToken, id);
      if (selected?.id === id) setSelected(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  const runTest = async () => {
    if (!selected) return;
    setTesting(true);
    setTestResult(null);
    try {
      const params = JSON.parse(testParams) as Record<string, unknown>;
      const result = await testToolRegistry(accessToken, selected.id, params);
      setTestResult(result);
    } catch (e) {
      setTestResult({
        success: false,
        errorMessage: e instanceof Error ? e.message : "测试失败",
        durationMs: 0,
      });
    } finally {
      setTesting(false);
    }
  };

  const categoryFilters = useMemo(() => ["all", ...TOOL_CATEGORIES] as const, []);

  return (
    <div className="ui-page-enter h-full overflow-auto p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <UiPanelCard className="!p-0">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Tool 注册中心</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  按五类能力管理 Agent 可调用的 Tool。能力目录用于登记元数据；运行时 Handler 是 Agent 实际执行时加载的实现。
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  已注册 {metrics.total} · Groovy {metrics.groovy} · Java 内置 {metrics.javaBean} · 运行时{" "}
                  {metrics.runtimeHandlers}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <UiButton variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => void refresh()}>
                  刷新
                </UiButton>
                <UiButton
                  variant="secondary"
                  onClick={() => void reloadToolRegistry(accessToken).then(refresh).catch((e) => setError(String(e)))}
                >
                  重载运行时
                </UiButton>
                <UiButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  注册 Tool
                </UiButton>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs leading-5 text-indigo-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <span>{SANDBOX_HINT}</span>
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="px-2">
            <UiTabs tabs={MAIN_TABS} activeTab={mainTab} onChange={(id) => setMainTab(id as MainTab)} />
          </div>

          <div className="px-6 pb-6">
            {mainTab === "registry" && (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="ui-stat-card !p-4">
                    <p className="text-xs font-medium text-slate-500">已注册</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.total}</p>
                  </div>
                  <div className="ui-stat-card !p-4">
                    <p className="text-xs font-medium text-slate-500">Groovy 可执行</p>
                    <p className="mt-1 text-2xl font-bold text-violet-700">{metrics.groovy}</p>
                  </div>
                  <div className="ui-stat-card !p-4">
                    <p className="text-xs font-medium text-slate-500">Java / CLI 内置</p>
                    <p className="mt-1 text-2xl font-bold text-indigo-700">{metrics.javaBean}</p>
                  </div>
                  <div className="ui-stat-card !p-4">
                    <p className="text-xs font-medium text-slate-500">运行时 Handler</p>
                    <p className="mt-1 text-2xl font-bold text-slate-800">{metrics.runtimeHandlers}</p>
                  </div>
                </div>

                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {categoryFilters.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCategory(item)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors ring-1",
                          category === item
                            ? "bg-indigo-600 text-white ring-indigo-600 shadow-sm"
                            : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                        )}
                      >
                        {categoryLabels[item] ?? item}
                        {item !== "all" && (
                          <span className="ml-1 opacity-80">({metrics.byCategory[item as ToolCategory]})</span>
                        )}
                        {item === "all" && <span className="ml-1 opacity-80">({metrics.total})</span>}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="搜索名称、Key、说明"
                      className="ui-input w-full min-w-[240px] pl-9 lg:w-72"
                    />
                  </div>
                </div>

                {category !== "all" && (
                  <p className="mb-3 text-xs text-slate-500">{TOOL_CATEGORY_DESCRIPTIONS[category as ToolCategory]}</p>
                )}

                {loading ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    加载中
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
                    当前筛选下暂无 Tool，可调整分类或点击「注册 Tool」
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((tool) => {
                      const cat = tool.category as ToolCategory;
                      const active = selected?.id === tool.id;
                      const RuntimeIcon =
                        tool.runtimeKind === "CLI" ? Terminal : tool.runtimeKind === "GROOVY" ? Cpu : Server;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => selectTool(tool)}
                          className={cn("ui-catalog-row group", active && "ui-catalog-row-active")}
                        >
                          <div
                            className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                              categoryAccent[cat] ?? "from-slate-500 to-slate-600",
                            )}
                          >
                            {categoryIcons[cat] ?? <Wrench className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-slate-900">{tool.toolName}</h3>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1",
                                  categoryStyles[cat] ?? "bg-slate-50 text-slate-600 ring-slate-500/20",
                                )}
                              >
                                {categoryLabels[tool.category] ?? tool.category}
                              </span>
                              <UiBadge type="default">{runtimeLabels[tool.runtimeKind] ?? tool.runtimeKind}</UiBadge>
                              <UiBadge type={tool.isEnabled ? "success" : "warning"}>
                                {tool.isEnabled ? "已启用" : "已禁用"}
                              </UiBadge>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{tool.toolKey}</p>
                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{tool.description}</p>
                          </div>
                          <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                            <span className="text-[10px] text-slate-400">
                              {sideEffectLabels[tool.sideEffect] ?? tool.sideEffect}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                              查看详情 <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                          <RuntimeIcon className="h-4 w-4 shrink-0 text-slate-300 sm:hidden" />
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-500" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {mainTab === "runtime" && (
              <>
                <p className="mb-4 text-sm text-slate-500">
                  下列 Handler 由 Spring 注册到 ToolExecutor，Agent 对话时按 <code className="text-xs">toolKey</code>{" "}
                  调用。带「已登记」标记的项在能力目录中有对应元数据。
                </p>
                <div className="mb-4 relative max-w-md">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={runtimeKeyword}
                    onChange={(e) => setRuntimeKeyword(e.target.value)}
                    placeholder="搜索 toolKey、说明"
                    className="ui-input w-full pl-9"
                  />
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <table className="ui-table w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-3">toolKey</th>
                        <th className="px-4 py-3">说明</th>
                        <th className="px-4 py-3">权限</th>
                        <th className="px-4 py-3">目录</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRuntime.map((item) => (
                        <tr key={item.toolKey} className="border-t border-slate-50">
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-800">
                            {item.toolKey}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{item.description}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{item.permission}</td>
                          <td className="px-4 py-2.5">
                            {registryKeys.has(item.toolKey) ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                已登记
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">仅运行时</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </UiPanelCard>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selected && (
              <>
                <motion.button
                  type="button"
                  aria-label="关闭 Tool 详情"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="ui-drawer-mask fixed inset-0 z-[80]"
                  onClick={() => setSelected(null)}
                />
                <motion.aside
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="tool-detail-title"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                  className="ui-drawer-panel fixed inset-y-0 right-0 z-[81] w-full max-w-[28rem] sm:max-w-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="ui-drawer-header px-5 pb-0 pt-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 id="tool-detail-title" className="truncate text-lg font-bold text-slate-900">
                            {selected.toolName}
                          </h3>
                          <button
                            type="button"
                            onClick={() => setSelected(null)}
                            className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{selected.toolKey}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1",
                              categoryStyles[selected.category as ToolCategory],
                            )}
                          >
                            {categoryLabels[selected.category]}
                          </span>
                          <UiBadge type="default">{runtimeLabels[selected.runtimeKind] ?? selected.runtimeKind}</UiBadge>
                          <UiBadge type={selected.isEnabled ? "success" : "warning"}>
                            {selected.isEnabled ? "已启用" : "已禁用"}
                          </UiBadge>
                        </div>
                      </div>
                    </div>
                    {selected.description && (
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{selected.description}</p>
                    )}
                    <UiTabs
                      tabs={DRAWER_TABS}
                      activeTab={drawerTab}
                      onChange={(id) => setDrawerTab(id as DrawerTab)}
                      className="mb-0 mt-4 px-0"
                    />
                  </div>

                  <div className="scrollbar-default min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {drawerTab === "overview" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <ToolMetaCard
                            icon={<Server className="h-3.5 w-3.5" />}
                            label="运行时"
                            value={runtimeLabels[selected.runtimeKind] ?? selected.runtimeKind}
                          />
                          <ToolMetaCard
                            icon={<Shield className="h-3.5 w-3.5" />}
                            label="权限"
                            value={selected.permissionCode}
                          />
                          <ToolMetaCard
                            icon={<Info className="h-3.5 w-3.5" />}
                            label="副作用"
                            value={sideEffectLabels[selected.sideEffect] ?? selected.sideEffect}
                          />
                          <ToolMetaCard
                            icon={<Layers className="h-3.5 w-3.5" />}
                            label="数据范围"
                            value={sensitivityLabels[selected.dataSensitivity] ?? selected.dataSensitivity}
                          />
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600">
                          <span className="font-semibold text-slate-500">连接器</span>
                          <span className="ml-2 font-mono">{selected.connector}</span>
                          <span className="mx-2 text-slate-300">·</span>
                          <span className="font-semibold text-slate-500">版本</span>
                          <span className="ml-1">{selected.version}</span>
                        </div>
                        {selected.runtimeKind === "JAVA_BEAN" && (
                          <p className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-xs leading-5 text-indigo-900">
                            此项为能力目录元数据，实际逻辑由 Java Handler 实现。可在「运行时 Handler」页签确认是否已加载。
                          </p>
                        )}
                        {selected.scriptContent && (
                          <div>
                            <UiSectionHeading>Groovy 脚本</UiSectionHeading>
                            <pre className="scrollbar-default max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] leading-5 text-slate-100">
                              {selected.scriptContent}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {drawerTab === "test" && (
                      <div className="space-y-3">
                        <p className="text-xs leading-5 text-slate-500">
                          按入参 Schema 构造 JSON，通过 ToolExecutor 执行。Groovy 类 Tool 使用{" "}
                          <code className="rounded bg-slate-100 px-1 font-mono text-[10px]">bindings</code> 传入变量。
                        </p>
                        <textarea
                          value={testParams}
                          onChange={(e) => setTestParams(e.target.value)}
                          rows={10}
                          className="ui-input scrollbar-default w-full font-mono text-xs"
                        />
                        <UiButton
                          variant="primary"
                          className="w-full sm:w-auto"
                          icon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          onClick={() => void runTest()}
                          disabled={testing}
                        >
                          执行测试
                        </UiButton>
                        {testResult && (
                          <pre
                            className={cn(
                              "scrollbar-default max-h-64 overflow-auto rounded-xl p-3 font-mono text-[11px] leading-5",
                              testResult.success
                                ? "border border-emerald-200 bg-emerald-950 text-emerald-50"
                                : "border border-red-200 bg-red-950 text-red-50",
                            )}
                          >
                            {JSON.stringify(testResult, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {drawerTab === "schema" && (
                      <div className="space-y-4">
                        <div>
                          <UiSectionHeading>入参 Schema</UiSectionHeading>
                          <pre className="scrollbar-default max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] text-slate-100">
                            {formatSchema(selected.inputSchema)}
                          </pre>
                        </div>
                        <div>
                          <UiSectionHeading>出参 Schema</UiSectionHeading>
                          <pre className="scrollbar-default max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] text-slate-100">
                            {formatSchema(selected.outputSchema)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-sm">
                    <UiButton variant="secondary" className="flex-1" onClick={() => openEdit(selected)}>
                      编辑
                    </UiButton>
                    <UiButton
                      variant="danger"
                      className="flex-1"
                      icon={<Trash2 className="h-4 w-4" />}
                      onClick={() => void removeTool(selected.id)}
                    >
                      删除
                    </UiButton>
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {editorOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ui-modal-mask fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tool-editor-title"
              >
                <button
                  type="button"
                  aria-label="关闭"
                  className="absolute inset-0"
                  onClick={() => setEditorOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 10 }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
                  className="ui-modal-enter relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                      <h3 id="tool-editor-title" className="text-lg font-bold text-slate-900">
                        {editingId ? "编辑 Tool" : "注册 Tool"}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">脚本型 Tool 使用 Groovy，保存后自动重载到运行时。</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="scrollbar-default min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs">
                  <span className="ui-label">Tool Key</span>
                  <input
                    className="ui-input mt-1 w-full"
                    value={form.toolKey}
                    onChange={(e) => setForm({ ...form, toolKey: e.target.value })}
                    disabled={!!editingId}
                  />
                </label>
                <label className="block text-xs">
                  <span className="ui-label">名称</span>
                  <input
                    className="ui-input mt-1 w-full"
                    value={form.toolName}
                    onChange={(e) => setForm({ ...form, toolName: e.target.value })}
                  />
                </label>
                <label className="block text-xs">
                  <span className="ui-label">能力分类</span>
                  <select
                    className="ui-input mt-1 w-full"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {TOOL_CATEGORIES.map((k) => (
                      <option key={k} value={k}>
                        {TOOL_CATEGORY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="ui-label">实现方式</span>
                  <select
                    className="ui-input mt-1 w-full"
                    value={form.runtimeKind}
                    onChange={(e) => setForm({ ...form, runtimeKind: e.target.value })}
                  >
                    <option value="GROOVY">Groovy 脚本（可执行）</option>
                    <option value="JAVA_BEAN">Java 内置（仅元数据）</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-xs">
                <span className="ui-label">说明</span>
                <textarea
                  className="ui-input mt-1 w-full"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              {form.runtimeKind !== "JAVA_BEAN" && (
                <label className="mt-3 block text-xs">
                  <span className="ui-label">Groovy 脚本</span>
                  <textarea
                    className="ui-input mt-1 w-full font-mono text-xs"
                    rows={8}
                    value={form.scriptContent}
                    onChange={(e) => setForm({ ...form, scriptContent: e.target.value })}
                  />
                </label>
              )}
                  </div>
                  <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
                    <UiButton variant="secondary" onClick={() => setEditorOpen(false)}>
                      取消
                    </UiButton>
                    <UiButton variant="primary" onClick={() => void saveForm()}>
                      保存
                    </UiButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
