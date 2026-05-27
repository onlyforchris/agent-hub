import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  ListTodo,
  PackageSearch,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import type { ReconciliationDifference } from "@/src/types.ts";
import type { AppViewMode } from "../RoleSwitcher.tsx";
import { syncAppUrlParams } from "@/src/lib/urlParams.ts";
import demoDifferencesRaw from "@/agent/connectors/fixtures/diffs.json";
import { statusLabels, statusStyles, typeLabels } from "./workbench/constants.ts";
import { getSLATier, sortBySLAUrgency } from "./workbench/workbenchUtils.ts";

interface WorkbenchViewProps {
  roleMode?: AppViewMode;
}

type AgentCardStatus = "active" | "planning";
type AgentAccent = "blue" | "violet" | "emerald";

interface AgentCard {
  id: string;
  name: string;
  domain: string;
  status: AgentCardStatus;
  owner: string;
  openCount: number;
  urgentCount: number;
  reviewCount: number;
  completedCount: number;
  latestItems: ReconciliationDifference[];
  actionLabel: string;
  actionTab: string;
  accent: AgentAccent;
  icon: React.ElementType;
}

const demoDifferences = demoDifferencesRaw as ReconciliationDifference[];
const DIFF_STATE_STORAGE_KEY = "agent_hub_diff_state_v1";

function cloneDifferences(items: ReconciliationDifference[]) {
  return items.map((item) => ({ ...item }));
}

function loadPersistedDiffState(): Record<string, Partial<ReconciliationDifference>> {
  try {
    const raw = localStorage.getItem(DIFF_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<ReconciliationDifference>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isClosed(diff: ReconciliationDifference) {
  return diff.status === "COMPLETED" || diff.status === "CONFIRMED" || diff.status === "PROCESSED";
}

function assignedToRole(diff: ReconciliationDifference, roleMode?: AppViewMode) {
  if (roleMode !== "sap" && roleMode !== "dms") return true;
  const groupId = diff.processingGroupId ?? "";
  const groupName = diff.processingGroupName ?? "";
  const handlerId = diff.handlerId ?? "";
  if (roleMode === "sap") {
    return groupId === "group-sap" || groupName.includes("SAP") || handlerId.startsWith("sap-");
  }
  if (roleMode === "dms") {
    return groupId === "group-dms" || groupName.includes("DMS") || handlerId.startsWith("dms-");
  }
  return true;
}

function visibleToBusinessRole(diff: ReconciliationDifference) {
  return diff.status === "FORWARDED_TO_BUSINESS" || diff.status === "BUSINESS_PROCESSING" || diff.status === "BUSINESS_FEEDBACK";
}

function roleCopy(roleMode?: AppViewMode) {
  if (roleMode === "sap") {
    return {
      title: "我的工作台",
      subtitle: "只展示与你有关的 SAP Agent 事项、重要待办和风险提醒。",
      owner: "SAP 处理组",
    };
  }
  if (roleMode === "dms") {
    return {
      title: "我的工作台",
      subtitle: "只展示与你有关的 DMS Agent 事项、重要待办和风险提醒。",
      owner: "DMS 处理组",
    };
  }
  return {
    title: "我的工作台",
    subtitle: "只展示与你有关的 Agent、重要待办和风险提醒。",
    owner: "财务负责人",
  };
}

function MetricPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "blue" | "amber" | "rose" | "emerald" | "slate";
}) {
  const toneClass: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
  };

  return (
    <div className={cn("rounded-md px-3 py-2 ring-1", toneClass[tone])}>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function AgentMetricTile({
  label,
  value,
  helper,
  tone,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "blue" | "amber" | "rose" | "emerald";
  icon: React.ElementType;
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneClass: Record<string, string> = {
    blue: "border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100/70",
    amber: "border-amber-100 bg-amber-50 text-amber-700 hover:border-amber-200 hover:bg-amber-100/70",
    rose: "border-rose-100 bg-rose-50 text-rose-700 hover:border-rose-200 hover:bg-rose-100/70",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100/70",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex min-h-[92px] flex-col justify-between rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-70",
        toneClass[tone],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-500">{label}</span>
        <Icon className="h-4 w-4 opacity-70 transition group-hover:scale-105" />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{helper}</div>
      </div>
    </button>
  );
}

function EmptyAgentState({ status }: { status: AgentCardStatus }) {
  return (
    <div className="flex min-h-[128px] flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
      {status === "planning" ? "暂未接入待办，后续按相同结构汇总展示" : "当前暂无待处理事项"}
    </div>
  );
}

function AgentCardView({
  agent,
  onOpen,
}: {
  agent: AgentCard;
  onOpen: (tab: string, billNo?: string) => void;
}) {
  const Icon = agent.icon;
  const active = agent.status === "active";
  const accentClass: Record<AgentAccent, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  const accentBar: Record<AgentAccent, string> = {
    blue: "from-blue-500 to-cyan-400",
    violet: "from-violet-500 to-fuchsia-400",
    emerald: "from-emerald-500 to-teal-400",
  };

  return (
    <section className="flex max-h-[clamp(360px,48vh,560px)] min-h-[320px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className={cn("h-1 shrink-0 bg-gradient-to-r", accentBar[agent.accent])} />
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md border", accentClass[agent.accent])}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{agent.name}</h3>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  active ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-slate-100 text-slate-500",
                )}>
                  {active ? "已接入" : "规划中"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{agent.domain}</p>
              <p className="mt-1 text-xs text-slate-400">归属：{agent.owner}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpen(agent.actionTab)}
            disabled={!active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400",
              active ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-200 text-slate-400",
            )}
          >
            {agent.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 p-5 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <div className="grid content-start grid-cols-2 gap-3">
          <AgentMetricTile
            label="待处理"
            value={agent.openCount}
            helper="进入归因处理"
            tone="blue"
            icon={ListTodo}
            disabled={!active}
            onClick={() => onOpen("sceneAttribution")}
          />
          <AgentMetricTile
            label="需复核"
            value={agent.reviewCount}
            helper="查看待确认"
            tone="amber"
            icon={ClipboardCheck}
            disabled={!active}
            onClick={() => onOpen("sceneAttribution")}
          />
          <AgentMetricTile
            label="SLA 风险"
            value={agent.urgentCount}
            helper="优先处理预警"
            tone="rose"
            icon={Timer}
            disabled={!active}
            onClick={() => onOpen("sceneAttribution")}
          />
          <AgentMetricTile
            label="已闭环"
            value={agent.completedCount}
            helper="查看历史案例"
            tone="emerald"
            icon={CheckCircle2}
            disabled={!active}
            onClick={() => onOpen("sceneCases")}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ListTodo className="h-4 w-4 text-blue-600" />
              重要事项
            </div>
            {active && agent.urgentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-100">
                <ShieldAlert className="h-3 w-3" />
                优先处理超时与预警
              </span>
            )}
          </div>
          {agent.latestItems.length === 0 ? (
            <EmptyAgentState status={agent.status} />
          ) : (
            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
              {agent.latestItems.map((diff) => {
                const tier = getSLATier(diff);
                return (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => onOpen(agent.actionTab, diff.billNo)}
                    className="grid w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 lg:grid-cols-[1fr_120px_100px_90px]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">{diff.billNo}</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", statusStyles[diff.status])}>
                          {statusLabels[diff.status] ?? diff.status}
                        </span>
                        {tier !== "normal" && (
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                            tier === "overdue" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
                          )}>
                            {tier === "overdue" ? "超时" : "预警"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{diff.desc}</p>
                    </div>
                    <div className="text-xs">
                      <div className="text-slate-400">Agent 事项</div>
                      <div className="mt-1 font-bold text-slate-700">{typeLabels[diff.type]}</div>
                    </div>
                    <div className="text-xs">
                      <div className="text-slate-400">责任系统</div>
                      <div className="mt-1 font-bold text-slate-700">{diff.ownerSystem ?? "-"}</div>
                    </div>
                    <div className="self-center text-right text-xs font-bold text-blue-700">查看</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function WorkbenchView({ roleMode = "finance" }: WorkbenchViewProps) {
  const [differences, setDifferences] = useState<ReconciliationDifference[]>([]);
  const copy = roleCopy(roleMode);
  const isBusinessProcessor = roleMode === "sap" || roleMode === "dms";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/differences")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        return res.json() as Promise<ReconciliationDifference[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const base = cloneDifferences(Array.isArray(data) && data.length > 0 ? data : demoDifferences);
        const persisted = loadPersistedDiffState();
        setDifferences(base.map((item) => (persisted[item.id] ? { ...item, ...persisted[item.id] } : item)));
      })
      .catch((error) => {
        console.warn(error);
        if (cancelled) return;
        const base = cloneDifferences(demoDifferences);
        const persisted = loadPersistedDiffState();
        setDifferences(base.map((item) => (persisted[item.id] ? { ...item, ...persisted[item.id] } : item)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scopedDifferences = useMemo(() => {
    if (!isBusinessProcessor) return differences;
    return differences.filter((diff) => assignedToRole(diff, roleMode) && visibleToBusinessRole(diff));
  }, [differences, isBusinessProcessor, roleMode]);

  const dataQualityAgent = useMemo<AgentCard>(() => {
    const openItems = scopedDifferences.filter((diff) => !isClosed(diff));
    const urgentItems = openItems.filter((diff) => getSLATier(diff) !== "normal");
    const reviewItems = scopedDifferences.filter((diff) =>
      diff.status === "NEEDS_REVIEW" ||
      diff.status === "FINANCE_CONFIRMED" ||
      diff.status === "FINANCE_REVIEWING" ||
      diff.status === "BUSINESS_FEEDBACK"
    );
    const completedItems = scopedDifferences.filter(isClosed);

    return {
      id: "data-quality",
      name: "对账治理 Agent",
      domain: "对账差异归因、复核、转派和闭环跟踪",
      status: "active",
      owner: copy.owner,
      openCount: openItems.length,
      urgentCount: urgentItems.length,
      reviewCount: reviewItems.length,
      completedCount: completedItems.length,
      latestItems: [...openItems].sort(sortBySLAUrgency),
      actionLabel: isBusinessProcessor ? "处理我的任务" : "进入清单",
      actionTab: "sceneAttribution",
      accent: "blue",
      icon: Database,
    };
  }, [copy.owner, isBusinessProcessor, scopedDifferences]);

  const plannedAgents = useMemo<AgentCard[]>(() => {
    if (isBusinessProcessor) return [];
    return [
      {
        id: "ar-quality",
        name: "应收质检 Agent",
        domain: "应收账龄、信用额度、坏账准备异常识别",
        status: "planning",
        owner: "财务核算组",
        openCount: 0,
        urgentCount: 0,
        reviewCount: 0,
        completedCount: 0,
        latestItems: [],
        actionLabel: "暂未开放",
        actionTab: "workbench",
        accent: "violet",
        icon: ClipboardCheck,
      },
      {
        id: "inventory-quality",
        name: "库存质检 Agent",
        domain: "WMS / DMS / 渠道库存多源比对与积压预警",
        status: "planning",
        owner: "供应链 IT",
        openCount: 0,
        urgentCount: 0,
        reviewCount: 0,
        completedCount: 0,
        latestItems: [],
        actionLabel: "暂未开放",
        actionTab: "workbench",
        accent: "emerald",
        icon: PackageSearch,
      },
    ];
  }, [isBusinessProcessor]);

  const agents = useMemo(() => [dataQualityAgent, ...plannedAgents], [dataQualityAgent, plannedAgents]);
  const totals = useMemo(() => ({
    activeAgents: agents.filter((agent) => agent.status === "active").length,
    open: agents.reduce((sum, agent) => sum + agent.openCount, 0),
    urgent: agents.reduce((sum, agent) => sum + agent.urgentCount, 0),
    review: agents.reduce((sum, agent) => sum + agent.reviewCount, 0),
  }), [agents]);

  const navigateTo = useCallback((tab: string, billNo?: string) => {
    syncAppUrlParams({ billNo: billNo ?? null, workbenchTab: null });
    window.dispatchEvent(new CustomEvent("agent-hub-tab-switch", { detail: { tab, billNo: billNo ?? null } }));
  }, []);

  return (
    <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden bg-slate-50/60 p-[clamp(16px,2vw,24px)]">
      <div className="flex w-full min-w-0 flex-col gap-[clamp(14px,2vh,22px)] pb-8">
        <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{copy.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricPill label="已接入 Agent" value={totals.activeAgents} tone="slate" />
              <MetricPill label="待处理" value={totals.open} tone="blue" />
              <MetricPill label="需复核" value={totals.review} tone="amber" />
              <MetricPill label="SLA 风险" value={totals.urgent} tone={totals.urgent > 0 ? "rose" : "slate"} />
            </div>
          </div>
        </section>

        {totals.urgent > 0 && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-5 py-3 text-rose-800">
            <div className="flex items-center gap-2 text-sm font-bold">
              <AlertTriangle className="h-4 w-4" />
              当前有 {totals.urgent} 条 Agent 事项存在 SLA 风险
            </div>
            <button
              type="button"
              onClick={() => navigateTo("sceneAttribution")}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
            >
              优先处理
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>
        )}

        <div className="grid gap-[clamp(14px,2vh,22px)]">
          {agents.map((agent) => (
            <div key={agent.id} className="min-h-0">
              <AgentCardView agent={agent} onOpen={navigateTo} />
            </div>
          ))}
        </div>

        {totals.open === 0 && (
          <section className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            当前已接入 Agent 暂无待处理事项
          </section>
        )}
      </div>
    </div>
  );
}

