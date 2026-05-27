import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Wifi,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/src/lib/utils.ts";
import {
  createModelProvider,
  deleteModelProvider,
  fetchModelProviders,
  parseModelList,
  stringifyModelList,
  testModelProvider,
  updateModelProvider,
  type ModelProviderForm,
  type ModelProviderRow,
} from "@/src/api/modelProviders.ts";
import {
  fetchConversationSessions,
  fetchConversationTurns,
  fetchExecutionTraces,
  fetchLlmCalls,
  fetchMonitorSummary,
  fetchTokenTrend,
  type ConversationSessionSummary,
  type ConversationTurn,
  type ExecutionTraceRow,
  type LlmCallRecord,
  type ModelMonitorSummary,
  type TokenTrendPoint,
} from "@/src/api/modelMonitor.ts";
import { UiBadge, UiButton, UiPanelCard, UiStatCard, UiTabs, type TabItem } from "@/src/components/ui/primitives.tsx";
import { useAuth } from "../../auth.tsx";

type MainTab = "providers" | "overview" | "api" | "conversations";

const MAIN_TABS: TabItem[] = [
  { id: "providers", label: "模型配置", icon: <Cpu className="h-4 w-4" /> },
  { id: "overview", label: "Token 监控", icon: <Zap className="h-4 w-4" /> },
  { id: "api", label: "API 请求", icon: <Activity className="h-4 w-4" /> },
  { id: "conversations", label: "历史对话", icon: <MessageSquare className="h-4 w-4" /> },
];

function formatTime(value?: string) {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 19);
}

function formatNum(n?: number) {
  if (n === undefined || n === null) return "0";
  return n.toLocaleString("zh-CN");
}

const emptyForm: ModelProviderForm = {
  providerCode: "",
  providerName: "",
  baseUrl: "https://api.deepseek.com",
  apiKey: "",
  models: stringifyModelList(["deepseek-v4-flash"]),
  defaultModel: "deepseek-v4-flash",
  isEnabled: 1,
  sortOrder: 0,
  remark: "",
};

export function ModelsView() {
  const { accessToken, can } = useAuth();
  const [tab, setTab] = useState<MainTab>("providers");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const canViewProviders = can("system:model-provider:view");
  const canManage = can("system:model-provider:add");
  const canEdit = can("system:model-provider:edit");
  const canDelete = can("system:model-provider:delete");
  const canTest = can("system:model-provider:test");
  const canMonitor = can("system:model-monitor:view");

  const [providers, setProviders] = useState<ModelProviderRow[]>([]);
  const [summary, setSummary] = useState<ModelMonitorSummary | null>(null);
  const [trend, setTrend] = useState<TokenTrendPoint[]>([]);
  const [llmCalls, setLlmCalls] = useState<LlmCallRecord[]>([]);
  const [llmTotal, setLlmTotal] = useState(0);
  const [llmPage, setLlmPage] = useState(1);
  const [traces, setTraces] = useState<ExecutionTraceRow[]>([]);
  const [sessions, setSessions] = useState<ConversationSessionSummary[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [loadingTurns, setLoadingTurns] = useState(false);

  const [providerFilter, setProviderFilter] = useState("");
  const [llmStatusFilter, setLlmStatusFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModelProviderForm>(emptyForm);
  const [modelsText, setModelsText] = useState("deepseek-v4-flash");
  const [saving, setSaving] = useState(false);

  const loadProviders = useCallback(async () => {
    if (!canViewProviders || !accessToken) return;
    const rows = await fetchModelProviders(accessToken);
    setProviders(rows);
  }, [accessToken, canViewProviders]);

  const loadMonitor = useCallback(async () => {
    if (!canMonitor || !accessToken) return;
    const [sum, trendRows, callPage, tracePage, convPage] = await Promise.all([
      fetchMonitorSummary(accessToken),
      fetchTokenTrend(accessToken, 7),
      fetchLlmCalls(accessToken, { page: llmPage, pageSize: 10, status: llmStatusFilter === "" ? undefined : Number(llmStatusFilter) }),
      fetchExecutionTraces(accessToken, { page: 1, pageSize: 5 }),
      fetchConversationSessions(accessToken, {
        page: sessionPage,
        pageSize: 8,
        sessionId: sessionFilter || undefined,
      }),
    ]);
    setSummary(sum);
    setTrend(trendRows);
    setLlmCalls(callPage.records);
    setLlmTotal(callPage.total);
    setTraces(tracePage.records);
    setSessions(convPage.records);
    setSessionTotal(convPage.total);
  }, [accessToken, canMonitor, llmPage, llmStatusFilter, sessionFilter, sessionPage]);

  const refreshAll = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      await Promise.all([loadProviders(), loadMonitor()]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "加载失败");
    } finally {
      setBusy(false);
    }
  }, [loadMonitor, loadProviders]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (tab === "api" || tab === "overview") {
      void loadMonitor().catch((e) => setMessage(e instanceof Error ? e.message : "监控数据加载失败"));
    }
  }, [tab, llmPage, llmStatusFilter, sessionPage, sessionFilter, loadMonitor]);

  useEffect(() => {
    if (!selectedSession || !accessToken) return;
    setLoadingTurns(true);
    fetchConversationTurns(accessToken, selectedSession)
      .then(setTurns)
      .catch((e) => setMessage(e instanceof Error ? e.message : "加载对话失败"))
      .finally(() => setLoadingTurns(false));
  }, [selectedSession, accessToken]);

  const filteredProviders = useMemo(() => {
    const q = providerFilter.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.providerCode.toLowerCase().includes(q) ||
        p.providerName.toLowerCase().includes(q) ||
        (p.defaultModel ?? "").toLowerCase().includes(q),
    );
  }, [providerFilter, providers]);

  const trendChartData = useMemo(
    () =>
      trend.map((t) => ({
        date: t.date.slice(5),
        tokens: t.inputTokens + t.outputTokens,
        input: t.inputTokens,
        output: t.outputTokens,
      })),
    [trend],
  );

  const openCreate = () => {
    setFormMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setModelsText("deepseek-v4-flash");
    setDialogOpen(true);
  };

  const openEdit = (row: ModelProviderRow) => {
    setFormMode("edit");
    setEditingId(row.id);
    const list = parseModelList(row.models);
    setModelsText(list.join(", "));
    setForm({
      providerCode: row.providerCode,
      providerName: row.providerName,
      baseUrl: row.baseUrl ?? "",
      apiKey: "",
      models: row.models,
      defaultModel: row.defaultModel ?? "",
      isEnabled: row.isEnabled ?? 1,
      sortOrder: row.sortOrder ?? 0,
      remark: row.remark ?? "",
    });
    setDialogOpen(true);
  };

  const submitForm = async () => {
    if (!accessToken || saving) return;
    if (!form.providerCode.trim() || !form.providerName.trim()) {
      setMessage("请填写供应商编码和显示名称");
      return;
    }
    if (formMode === "create" && !(form.apiKey ?? "").trim()) {
      setMessage("新增时请填写 API Key");
      return;
    }
    const modelList = modelsText
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload: ModelProviderForm = {
      ...form,
      providerCode: form.providerCode.trim(),
      providerName: form.providerName.trim(),
      models: stringifyModelList(modelList),
      defaultModel: form.defaultModel || modelList[0] || "",
    };
    setSaving(true);
    setMessage("");
    try {
      if (formMode === "create") {
        await createModelProvider(accessToken, payload);
        setMessage("已新增模型供应商");
      } else if (editingId) {
        const body: Partial<ModelProviderForm> = {
          providerName: payload.providerName,
          baseUrl: payload.baseUrl,
          models: payload.models,
          defaultModel: payload.defaultModel,
          isEnabled: payload.isEnabled,
          sortOrder: payload.sortOrder,
          remark: payload.remark,
        };
        if ((form.apiKey ?? "").trim()) {
          body.apiKey = form.apiKey?.trim();
        }
        await updateModelProvider(accessToken, editingId, body);
        setMessage("已更新模型供应商");
      }
      setDialogOpen(false);
      await refreshAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (id: string) => {
    if (!accessToken) return;
    try {
      const result = await testModelProvider(accessToken, id);
      setMessage(result.success ? `连接成功 (${result.latencyMs}ms)` : result.message);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "测试失败");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!accessToken || !window.confirm(`确认删除「${name}」？`)) return;
    try {
      await deleteModelProvider(accessToken, id);
      setMessage("已删除");
      await loadProviders();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "删除失败");
    }
  };

  if (!canViewProviders && !canMonitor) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">
        无权限访问模型配置与监控，请联系管理员开通 system:model-provider:view 或 system:model-monitor:view。
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 p-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-800">模型配置与监控</h1>
          <p className="text-sm text-slate-500">
            管理大模型供应商、连接测试，并查看 Token 消耗、API 调用与历史会话运行态。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UiButton variant="secondary" icon={<RefreshCcw className={cn("h-4 w-4", busy && "animate-spin")} />} onClick={() => void refreshAll()} disabled={busy}>
            刷新
          </UiButton>
          {canManage && tab === "providers" ? (
            <UiButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              新增供应商
            </UiButton>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-2 text-sm text-indigo-800">{message}</div>
      ) : null}

      {summary && canMonitor ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UiStatCard
            label="今日 LLM 调用"
            value={formatNum(summary.llmCallCountToday)}
            icon={<Activity className="h-6 w-6" />}
            iconClassName="bg-blue-50 text-blue-500"
          />
          <UiStatCard
            label="今日 Token（入/出）"
            value={`${formatNum(summary.inputTokensToday)} / ${formatNum(summary.outputTokensToday)}`}
            icon={<Zap className="h-6 w-6" />}
            iconClassName="bg-purple-50 text-purple-500"
          />
          <UiStatCard
            label="今日失败调用"
            value={formatNum(summary.failedCallsToday)}
            icon={<XCircle className="h-6 w-6" />}
            iconClassName="bg-rose-50 text-rose-500"
          />
          <UiStatCard
            label="启用供应商 / 会话数"
            value={`${summary.activeProviders} / ${summary.conversationSessions}`}
            icon={<Bot className="h-6 w-6" />}
            iconClassName="bg-emerald-50 text-emerald-500"
          />
        </div>
      ) : null}

      <UiPanelCard className="!p-0">
        <div className="px-6 pt-4">
          <UiTabs tabs={MAIN_TABS} activeTab={tab} onChange={(id) => setTab(id as MainTab)} />
        </div>

        <div className="px-6 pb-6">
          {tab === "providers" && canViewProviders ? (
            <ProvidersTab
              rows={filteredProviders}
              filter={providerFilter}
              onFilterChange={setProviderFilter}
              canEdit={canEdit}
              canDelete={canDelete}
              canTest={canTest}
              onEdit={openEdit}
              onDelete={handleDelete}
              onTest={handleTest}
            />
          ) : null}

          {tab === "overview" && canMonitor ? (
            <OverviewTab summary={summary} chartData={trendChartData} traces={traces} />
          ) : null}

          {tab === "api" && canMonitor ? (
            <ApiCallsTab
              rows={llmCalls}
              total={llmTotal}
              page={llmPage}
              statusFilter={llmStatusFilter}
              onStatusChange={(v) => {
                setLlmStatusFilter(v);
                setLlmPage(1);
              }}
              onPageChange={setLlmPage}
            />
          ) : null}

          {tab === "conversations" && canMonitor ? (
            <ConversationsTab
              sessions={sessions}
              total={sessionTotal}
              page={sessionPage}
              filter={sessionFilter}
              onFilterChange={setSessionFilter}
              onPageChange={setSessionPage}
              selectedSession={selectedSession}
              onSelectSession={setSelectedSession}
              turns={turns}
              loadingTurns={loadingTurns}
            />
          ) : null}
        </div>
      </UiPanelCard>

      <AnimatePresence>
        {dialogOpen ? (
          <ProviderFormDialog
            mode={formMode}
            form={form}
            modelsText={modelsText}
            saving={saving}
            onClose={() => !saving && setDialogOpen(false)}
            onChange={setForm}
            onModelsTextChange={setModelsText}
            onSubmit={() => void submitForm()}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ProvidersTab({
  rows,
  filter,
  onFilterChange,
  canEdit,
  canDelete,
  canTest,
  onEdit,
  onDelete,
  onTest,
}: {
  rows: ModelProviderRow[];
  filter: string;
  onFilterChange: (v: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canTest: boolean;
  onEdit: (row: ModelProviderRow) => void;
  onDelete: (id: string, name: string) => void;
  onTest: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="ui-input w-full pl-10"
          placeholder="搜索编码、名称、默认模型…"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="ui-table w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">供应商</th>
              <th className="px-4 py-3">Base URL</th>
              <th className="px-4 py-3">默认模型</th>
              <th className="px-4 py-3">API Key</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 transition-colors hover:bg-indigo-50/20">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{row.providerName}</div>
                  <div className="font-mono text-xs text-slate-400">{row.providerCode}</div>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={row.baseUrl}>
                  {row.baseUrl || "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{row.defaultModel || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.apiKey || "—"}</td>
                <td className="px-4 py-3">
                  <UiBadge type={row.isEnabled === 1 ? "success" : "default"}>{row.isEnabled === 1 ? "启用" : "禁用"}</UiBadge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {canTest ? (
                      <button type="button" className="ui-btn-secondary !px-2 !py-1 text-xs" onClick={() => void onTest(row.id)}>
                        <Wifi className="mr-1 inline h-3 w-3" />
                        测试
                      </button>
                    ) : null}
                    {canEdit ? (
                      <button type="button" className="ui-btn-secondary !px-2 !py-1 text-xs" onClick={() => onEdit(row)}>
                        <Pencil className="mr-1 inline h-3 w-3" />
                        编辑
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="ui-btn-danger !px-2 !py-1 text-xs" onClick={() => void onDelete(row.id, row.providerName)}>
                        <Trash2 className="mr-1 inline h-3 w-3" />
                        删除
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  暂无模型供应商，点击「新增供应商」开始配置。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OverviewTab({
  summary,
  chartData,
  traces,
}: {
  summary: ModelMonitorSummary | null;
  chartData: Array<{ date: string; tokens: number; input: number; output: number }>;
  traces: ExecutionTraceRow[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <UiPanelCard className="xl:col-span-2">
        <h3 className="mb-4 text-lg font-bold text-slate-800">近 7 日 Token 趋势</h3>
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="tokens" stroke="#4f46e5" fill="url(#tokenGrad)" name="总 Token" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">暂无 Token 统计数据</div>
          )}
        </div>
      </UiPanelCard>
      <UiPanelCard>
        <h3 className="mb-4 text-lg font-bold text-slate-800">按供应商分布（今日）</h3>
        <div className="space-y-3">
          {(summary?.tokensByProvider ?? []).map((item) => (
            <div key={String(item.provider)} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
              <span className="text-sm font-medium text-slate-700">{item.provider || "unknown"}</span>
              <span className="font-mono text-xs text-slate-500">
                {formatNum(Number(item.total_tokens))} tok · {formatNum(Number(item.call_count))} 次
              </span>
            </div>
          ))}
          {(summary?.tokensByProvider ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">今日尚无分供应商统计</p>
          ) : null}
        </div>
      </UiPanelCard>
      <UiPanelCard className="xl:col-span-3">
        <h3 className="mb-4 text-lg font-bold text-slate-800">最近 Agent 执行 Trace</h3>
        <div className="space-y-2">
          {traces.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 hover:border-indigo-200">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-600">{t.traceId}</span>
                  <UiBadge type={t.status === 1 ? "success" : "danger"}>{t.status === 1 ? "成功" : "失败"}</UiBadge>
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">{t.inputSummary || "—"}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>{t.agentId} · {t.intentAction}</div>
                <div>{formatNum(t.llmTokens)} tok · {formatNum(t.durationMs)} ms</div>
                <div>{formatTime(t.startedAt)}</div>
              </div>
            </div>
          ))}
          {traces.length === 0 ? <p className="text-sm text-slate-400">暂无执行 Trace</p> : null}
        </div>
      </UiPanelCard>
    </div>
  );
}

function ApiCallsTab({
  rows,
  total,
  page,
  statusFilter,
  onStatusChange,
  onPageChange,
}: {
  rows: LlmCallRecord[];
  total: number;
  page: number;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  onPageChange: (p: number) => void;
}) {
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select className="ui-input w-40" value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
          <option value="">全部状态</option>
          <option value="1">成功</option>
          <option value="0">失败</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="ui-table w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">供应商 / 模型</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3 text-right">Token 入</th>
              <th className="px-4 py-3 text-right">Token 出</th>
              <th className="px-4 py-3 text-right">耗时</th>
              <th className="px-4 py-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-xs text-slate-500">{formatTime(row.createTime)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{row.modelProvider}</div>
                  <div className="font-mono text-xs text-slate-400">{row.modelName}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{row.agentId || "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{formatNum(row.inputTokens)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{formatNum(row.outputTokens)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{formatNum(row.durationMs)} ms</td>
                <td className="px-4 py-3">
                  {row.status === 1 ? (
                    <UiBadge type="success">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      成功
                    </UiBadge>
                  ) : (
                    <span title={row.errorMessage}>
                      <UiBadge type="danger">失败</UiBadge>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={totalPages} onChange={onPageChange} />
    </div>
  );
}

function ConversationsTab({
  sessions,
  total,
  page,
  filter,
  onFilterChange,
  onPageChange,
  selectedSession,
  onSelectSession,
  turns,
  loadingTurns,
}: {
  sessions: ConversationSessionSummary[];
  total: number;
  page: number;
  filter: string;
  onFilterChange: (v: string) => void;
  onPageChange: (p: number) => void;
  selectedSession: string | null;
  onSelectSession: (id: string | null) => void;
  turns: ConversationTurn[];
  loadingTurns: boolean;
}) {
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <input
          className="ui-input w-full"
          placeholder="按 sessionId 筛选…"
          value={filter}
          onChange={(e) => {
            onFilterChange(e.target.value);
            onPageChange(1);
          }}
        />
        <div className="space-y-2">
          {sessions.map((s) => (
            <button
              key={s.session_id}
              type="button"
              onClick={() => onSelectSession(s.session_id)}
              className={cn(
                "w-full rounded-xl border p-4 text-left transition-all",
                selectedSession === s.session_id
                  ? "border-indigo-300 bg-indigo-50/50 shadow-sm"
                  : "border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-indigo-700">{s.session_id}</span>
                <UiBadge type="default">{s.turn_count} 轮</UiBadge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{s.last_input || "—"}</p>
              <p className="mt-1 text-xs text-slate-400">
                {s.agent_id} · {formatTime(String(s.last_time))}
              </p>
            </button>
          ))}
          {sessions.length === 0 ? <p className="text-sm text-slate-400">暂无历史会话</p> : null}
        </div>
        <Pager page={page} totalPages={totalPages} onChange={onPageChange} />
      </div>
      <UiPanelCard className="min-h-[320px]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">会话轮次</h3>
          {selectedSession ? (
            <button type="button" className="text-slate-400 hover:text-slate-600" onClick={() => onSelectSession(null)}>
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {loadingTurns ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中…
          </div>
        ) : selectedSession ? (
          <div className="max-h-[480px] space-y-4 overflow-y-auto pr-1">
            {turns.map((t) => (
              <div key={t.id} className="space-y-2 rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-400">{t.turnId} · {formatTime(t.createTime)}</div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-medium text-slate-500">用户：</span>
                  {t.userInput}
                </div>
                <div className="rounded-lg bg-indigo-50/60 px-3 py-2 text-sm text-slate-800">
                  <span className="font-medium text-indigo-600">Agent：</span>
                  {t.agentReply}
                </div>
              </div>
            ))}
            {turns.length === 0 ? <p className="text-sm text-slate-400">该会话暂无轮次记录</p> : null}
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-slate-400">选择左侧会话查看完整对话</p>
        )}
      </UiPanelCard>
    </div>
  );
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm text-slate-500">
      <button type="button" className="ui-btn-secondary !p-2" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span>
        {page} / {totalPages}
      </span>
      <button type="button" className="ui-btn-secondary !p-2" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProviderFormDialog({
  mode,
  form,
  modelsText,
  saving,
  onClose,
  onChange,
  onModelsTextChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: ModelProviderForm;
  modelsText: string;
  saving: boolean;
  onClose: () => void;
  onChange: (f: ModelProviderForm) => void;
  onModelsTextChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const content = (
    <motion.div
      className="ui-modal-mask fixed inset-0 z-[200] overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-provider-dialog-title"
    >
      <div className="flex min-h-full items-start justify-center p-4 py-10 sm:py-14">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
        <motion.div
          className="ui-modal-enter relative z-10 flex w-full max-w-lg max-h-[min(720px,calc(100dvh-5rem))] flex-col rounded-2xl border border-slate-100 bg-white shadow-2xl"
          initial={{ opacity: 0, scale: 0.98, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 id="model-provider-dialog-title" className="text-lg font-bold text-slate-800">
            {mode === "create" ? "新增模型供应商" : "编辑模型供应商"}
          </h3>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <label className="block">
            <span className="ui-label">供应商编码 *</span>
            <input
              className="ui-input mt-1 w-full"
              disabled={mode === "edit"}
              value={form.providerCode}
              onChange={(e) => onChange({ ...form, providerCode: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="ui-label">显示名称 *</span>
            <input className="ui-input mt-1 w-full" value={form.providerName} onChange={(e) => onChange({ ...form, providerName: e.target.value })} />
          </label>
          <label className="block">
            <span className="ui-label">Base URL</span>
            <input className="ui-input mt-1 w-full" value={form.baseUrl} onChange={(e) => onChange({ ...form, baseUrl: e.target.value })} />
          </label>
          <label className="block">
            <span className="ui-label">API Key {mode === "edit" ? "（留空不修改）" : "*"}</span>
            <input
              type="password"
              className="ui-input mt-1 w-full font-mono"
              value={form.apiKey ?? ""}
              onChange={(e) => onChange({ ...form, apiKey: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="ui-label">可用模型（逗号分隔）</span>
            <input className="ui-input mt-1 w-full font-mono text-xs" value={modelsText} onChange={(e) => onModelsTextChange(e.target.value)} />
          </label>
          <label className="block">
            <span className="ui-label">默认模型</span>
            <input className="ui-input mt-1 w-full font-mono text-xs" value={form.defaultModel} onChange={(e) => onChange({ ...form, defaultModel: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="ui-label">启用</span>
              <select
                className="ui-input mt-1 w-full"
                value={form.isEnabled}
                onChange={(e) => onChange({ ...form, isEnabled: Number(e.target.value) })}
              >
                <option value={1}>启用</option>
                <option value={0}>禁用</option>
              </select>
            </label>
            <label className="block">
              <span className="ui-label">排序</span>
              <input
                type="number"
                className="ui-input mt-1 w-full"
                value={form.sortOrder}
                onChange={(e) => onChange({ ...form, sortOrder: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <UiButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            取消
          </UiButton>
          <UiButton
            type="button"
            variant="primary"
            onClick={onSubmit}
            disabled={saving}
            icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            {saving ? "保存中…" : "保存"}
          </UiButton>
        </div>
        </motion.div>
      </div>
    </motion.div>
  );
  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
