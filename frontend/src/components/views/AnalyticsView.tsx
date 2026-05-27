import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Database,
  Layers,
  PieChart,
  Server,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import type { ReconciliationDifference } from "@/src/types.ts";
import type { AppViewMode } from "../RoleSwitcher.tsx";
import demoDifferencesRaw from "@/agent/connectors/fixtures/diffs.json";
import {
  governanceLevelColors,
  governanceLevelLabels,
} from "./workbench/constants.ts";
import {
  computeAttributionQuality,
  computeCauseRanking,
  computeGovernanceDistribution,
  computeGroupEfficiency,
  computeSystemDistribution,
  getSLATier,
} from "./workbench/workbenchUtils.ts";

interface AnalyticsViewProps {
  roleMode?: AppViewMode;
}

const demoDifferences = demoDifferencesRaw as ReconciliationDifference[];

type AgentKey = "dataQuality" | "arQuality" | "inventoryQuality";

const agentOptions: Array<{
  id: AgentKey;
  name: string;
  status: "online" | "planned";
  scope: string;
  owner: string;
  accent: string;
}> = [
  {
    id: "dataQuality",
    name: "对账治理 Agent",
    status: "online",
    scope: "对账差异归因、证据核对、责任转派与闭环治理",
    owner: "财务负责人",
    accent: "from-blue-500 to-cyan-400",
  },
  {
    id: "arQuality",
    name: "应收质检 Agent",
    status: "planned",
    scope: "信用额度、坏账准备、环账异常识别",
    owner: "财务核算组",
    accent: "from-violet-500 to-fuchsia-400",
  },
  {
    id: "inventoryQuality",
    name: "库存质检 Agent",
    status: "planned",
    scope: "WMS / DMS / 渠道库存多源比对与积压预警",
    owner: "供应链 IT",
    accent: "from-emerald-500 to-teal-400",
  },
];

function cloneDifferences(items: ReconciliationDifference[]) {
  return items.map((item) => ({ ...item }));
}

function ReportMetric({
  label, value, sub, tone = "slate",
}: {
  label: string; value: string | number; sub: string; tone?: "blue" | "amber" | "rose" | "emerald" | "slate";
}) {
  const toneMap: Record<string, string> = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-white text-slate-900",
  };
  return (
    <div className={cn("rounded-lg border p-4 text-left shadow-sm", toneMap[tone])}>
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{sub}</div>
    </div>
  );
}

function DistributionBars({ title, items, total }: { title: string; items: Array<{ label: string; count: number }>; total: number }) {
  const safeTotal = Math.max(1, total);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-bold text-slate-900"><PieChart className="h-4 w-4 text-blue-600" />{title}</h3>
      <div className="mt-4 space-y-3">
        {items.slice(0, 6).map(({ label, count }) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="font-bold text-slate-900">{count} 笔</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(8, (count / safeTotal) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentSelector({
  activeAgent,
  onSelect,
  dataCount,
}: {
  activeAgent: AgentKey;
  onSelect: (agent: AgentKey) => void;
  dataCount: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-1.5">
      <div className="grid gap-1.5 lg:grid-cols-3" role="tablist" aria-label="Agent 场景">
        {agentOptions.map((agent) => {
          const active = activeAgent === agent.id;
          const online = agent.status === "online";
          const count = agent.id === "dataQuality" ? dataCount : 0;
          const Icon = agent.id === "dataQuality" ? Database : Bot;
          return (
            <button
              key={agent.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(agent.id)}
              className={cn(
                "relative min-h-[82px] rounded-lg border px-4 py-3 text-left transition",
                active
                  ? "border-blue-200 bg-white shadow-sm"
                  : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white/80 hover:text-slate-900",
              )}
            >
              {active && (
                <>
                  <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-blue-600" />
                  <div className="absolute inset-x-4 -bottom-1 h-1 rounded-full bg-blue-500" />
                </>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md border", active || online ? "border-blue-100 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-400")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-900">{agent.name}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", online ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-slate-200 text-slate-500")}>
                        {online ? "已接入" : "规划中"}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{agent.scope}</span>
                    <span className="mt-1 block text-[10px] font-medium text-slate-400">归属：{agent.owner}</span>
                  </span>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-[10px] font-bold text-slate-400">样本数</span>
                  <span className={cn("block text-lg font-bold tabular-nums", online ? "text-blue-700" : "text-slate-400")}>{count}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlannedAgentEmpty({ agent }: { agent: (typeof agentOptions)[number] }) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <Bot className="mx-auto h-12 w-12 text-slate-300" />
      <h3 className="mt-4 text-lg font-bold text-slate-900">{agent.name} 运营分析暂未接入</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        后续接入后，将按该 Agent 的数据域独立统计运行量、异常原因、责任系统、处理周期和治理收益，不与对账治理 Agent 混合展示。
      </p>
      <div className="mx-auto mt-5 grid max-w-3xl gap-3 sm:grid-cols-4">
        <ReportMetric label="自动识别覆盖率" value="-" sub="待接入数据源" tone="slate" />
        <ReportMetric label="人工复核率" value="-" sub="待接入流程" tone="slate" />
        <ReportMetric label="治理标签数" value="-" sub="待定义口径" tone="slate" />
        <ReportMetric label="超时未处理" value="-" sub="待配置 SLA" tone="slate" />
      </div>
    </section>
  );
}

export function AnalyticsView({ roleMode = "finance" }: AnalyticsViewProps) {
  const [subTab, setSubTab] = useState<"level" | "system" | "cause" | "efficiency">("level");
  const [activeAgent, setActiveAgent] = useState<AgentKey>("dataQuality");
  const [differences, setDifferences] = useState<ReconciliationDifference[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/differences")
      .then((res) => { if (!res.ok) throw new Error(`Failed: ${res.status}`); return res.json() as Promise<ReconciliationDifference[]>; })
      .then((data) => { if (cancelled) return; setDifferences(cloneDifferences(Array.isArray(data) && data.length > 0 ? data : demoDifferences)); })
      .catch((error) => { console.warn(error); if (!cancelled) setDifferences(cloneDifferences(demoDifferences)); });
    return () => { cancelled = true; };
  }, []);

  const levelDist = useMemo(() => computeGovernanceDistribution(differences), [differences]);
  const sysDist = useMemo(() => computeSystemDistribution(differences), [differences]);
  const causeRank = useMemo(() => computeCauseRanking(differences), [differences]);
  const efficiency = useMemo(() => computeGroupEfficiency(differences), [differences]);
  const quality = useMemo(() => computeAttributionQuality(differences), [differences]);
  const currentAgent = agentOptions.find((agent) => agent.id === activeAgent) ?? agentOptions[0];
  const hasAgentData = currentAgent.status === "online";

  const subTabs: Array<{ id: typeof subTab; label: string; icon: React.ElementType }> = [
    { id: "level", label: "治理层级 L1-L5", icon: Layers },
    { id: "system", label: "责任系统排名", icon: Server },
    { id: "cause", label: "异常原因分类", icon: AlertTriangle },
    { id: "efficiency", label: "处理时长统计", icon: TrendingUp },
  ];

  return (
    <div className="h-full min-h-0 overflow-auto bg-slate-50/60 p-[clamp(16px,2vw,24px)]">
      <div className="flex w-full min-w-0 flex-col gap-5">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-xl font-bold text-slate-900">运营分析</h2>
            <p className="mt-1.5 text-sm text-slate-500">按 Agent 场景独立展示运行治理指标，避免不同业务域的差异原因、责任系统和处理周期混在一起。</p>
          </div>
          <div className="px-5 py-4">
            <AgentSelector activeAgent={activeAgent} onSelect={setActiveAgent} dataCount={differences.length} />
          </div>
        </section>

        {!hasAgentData ? (
          <PlannedAgentEmpty agent={currentAgent} />
        ) : (
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{currentAgent.name}</h3>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">已接入</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{currentAgent.scope}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                统计口径：当前批次与历史闭环样本
              </div>
            </div>
          </section>

          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <ReportMetric label="自动归因覆盖率" value={`${quality.autoRate}%`} sub={`${quality.autoAttributed}/${differences.length} 笔已归因`} tone="blue" />
            <ReportMetric label="人工改判率" value={`${quality.manualCorrectionRate}%`} sub="基于复核反馈统计" tone="amber" />
            <ReportMetric label="L3+根因覆盖" value={levelDist.filter(d => ["L3","L4","L5"].includes(d.level)).reduce((s,d)=>s+d.count,0)} sub="深层治理标签数" tone="emerald" />
            <ReportMetric label="超时未处理" value={differences.filter(d=>getSLATier(d)==="overdue").length} sub="需关注催办" tone="rose" />
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-2">
            {subTabs.map(t => (
              <button key={t.id} type="button" onClick={() => setSubTab(t.id)}
                className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition", subTab === t.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {subTab === "level" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <DistributionBars title="治理层级分布" items={levelDist.map(d=>({label:`${d.level} ${d.label}`,count:d.count}))} total={differences.length} />
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-2 font-bold text-slate-900"><PieChart className="h-4 w-4 text-indigo-600" />层级说明</h3>
                <div className="mt-4 space-y-2">
                  {levelDist.map(d => (
                    <div key={d.level} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", governanceLevelColors[d.level])}>{d.level}</span>
                        <span className="font-medium text-slate-700">{d.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${d.percentage}%` }} />
                        </div>
                        <span className="font-bold text-slate-900 tabular-nums">{d.count} 笔 ({d.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {subTab === "system" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <DistributionBars title="责任系统分布（未关闭）" items={sysDist.map(d=>({label:d.system,count:d.count}))} total={differences.filter(d=>d.status!=="CONFIRMED"&&d.status!=="PROCESSED"&&d.status!=="COMPLETED").length} />
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">各系统 SLA 状态</h3>
                <div className="space-y-3">
                  {["DMS","SAP","接口","DRP","主数据","WMS"].map(sys => {
                    const sysDiffs = differences.filter(d=>(d.ownerSystem??"").includes(sys));
                    const overdue = sysDiffs.filter(d=>getSLATier(d)==="overdue").length;
                    const warning = sysDiffs.filter(d=>getSLATier(d)==="warning").length;
                    if (sysDiffs.length===0) return null;
                    return (
                      <div key={sys} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                        <span className="font-bold text-slate-900">{sys}</span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-slate-500">共 {sysDiffs.length} 笔</span>
                          {warning>0 && <span className="font-bold text-amber-600">{warning} 预警</span>}
                          {overdue>0 && <span className="font-bold text-rose-600">{overdue} 超时</span>}
                          {warning===0 && overdue===0 && <span className="font-bold text-emerald-600">正常</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {subTab === "cause" && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b px-5 py-4"><h3 className="font-bold text-slate-900">异常原因排名</h3></div>
              <div className="divide-y">
                {causeRank.map((c,i) => (
                  <div key={c.cause} className="flex items-center gap-4 px-5 py-3">
                    <span className="text-lg font-bold text-slate-300 w-6">{i+1}</span>
                    <div className="flex-1"><span className="font-medium text-slate-900">{c.cause}</span></div>
                    <span className="font-bold text-slate-900 tabular-nums">{c.count} 笔</span>
                    <span className="text-xs text-slate-400">趋势平稳</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {subTab === "efficiency" && (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b px-5 py-4"><h3 className="font-bold text-slate-900">处理组效率</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-slate-50 text-left text-xs font-bold text-slate-500">
                    <th className="px-4 py-3">处理组</th><th className="px-4 py-3">总任务</th><th className="px-4 py-3">平均处理时长</th><th className="px-4 py-3">超时数</th><th className="px-4 py-3">准时率</th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {efficiency.map(e => (
                      <tr key={e.groupName} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-900">{e.groupName}</td>
                        <td className="px-4 py-3 tabular-nums">{e.totalTasks}</td>
                        <td className="px-4 py-3 tabular-nums">{e.avgHours}h</td>
                        <td className="px-4 py-3 tabular-nums"><span className={e.overdueCount>0?"font-bold text-rose-600":""}>{e.overdueCount}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-slate-200"><div className={cn("h-full rounded-full",e.onTimeRate>=90?"bg-emerald-500":e.onTimeRate>=70?"bg-amber-500":"bg-rose-500")} style={{width:`${e.onTimeRate}%`}}/></div>
                            <span className="font-bold tabular-nums">{e.onTimeRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

