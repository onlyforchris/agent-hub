import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  GitBranch,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils.ts";
import type { AgentRunDetail, AgentRunSummary } from "@/src/types.ts";

const stepIconMap: Record<string, React.ElementType> = {
  plan: Bot,
  tool_call: Wrench,
  rule: ShieldCheck,
  model: Sparkles,
  review_route: GitBranch,
  human: Activity,
};

const stepColorMap: Record<string, string> = {
  plan: "bg-indigo-50 text-indigo-700 border-indigo-200",
  tool_call: "bg-blue-50 text-blue-700 border-blue-200",
  rule: "bg-emerald-50 text-emerald-700 border-emerald-200",
  model: "bg-amber-50 text-amber-700 border-amber-200",
  review_route: "bg-rose-50 text-rose-700 border-rose-200",
  human: "bg-slate-50 text-slate-700 border-slate-200",
};

const statusStyles: Record<string, string> = {
  RUNNING: "bg-blue-50 text-blue-700 border-blue-200",
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
  NEEDS_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
};

function StepBadge({ stepType }: { stepType: string }) {
  const Icon = stepIconMap[stepType] ?? Activity;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
        stepColorMap[stepType] ?? "bg-slate-50 text-slate-700 border-slate-200",
      )}
    >
      <Icon className="h-3 w-3" />
      {stepType}
    </span>
  );
}

function formatJsonPreview(value: unknown, maxLen = 280): string {
  if (value === undefined || value === null) return "—";
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (text.length > maxLen) text = text.slice(0, maxLen) + " …";
  return text;
}

export function RunsView() {
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);
  const [selected, setSelected] = useState<AgentRunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const refreshList = async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/runs");
      const data: AgentRunSummary[] = await res.json();
      setRuns(data);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    refreshList();
  }, []);

  const loadDetail = async (runId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/runs/${runId}`);
      const data: AgentRunDetail = await res.json();
      setSelected(data);
    } finally {
      setLoadingDetail(false);
    }
  };

  const metrics = useMemo(() => {
    const total = runs.length;
    const success = runs.filter((r) => r.status === "SUCCESS").length;
    const review = runs.filter((r) => r.status === "NEEDS_REVIEW").length;
    const failed = runs.filter((r) => r.status === "FAILED").length;
    const avg = total === 0 ? 0 : Math.round(runs.reduce((a, b) => a + (b.durationMs ?? 0), 0) / total);
    return { total, success, review, failed, avg };
  }, [runs]);

  return (
    <div className="h-full overflow-auto bg-slate-50/60 p-6">
      <div className="flex flex-col gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Agent 执行追踪 (Trace)</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                每次 Agent 执行都会产生一个 Run，并按顺序记录 Plan / Tool / Rule / Model / Review 等步骤。该页面提供执行回放，是评审会现场展示「AI 在哪一步做了什么」的核心入口。
              </p>
            </div>
            <button
              onClick={refreshList}
              className="inline-flex items-center gap-2 self-start rounded border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCcw className={cn("h-4 w-4", loadingList && "animate-spin")} />
              刷新
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-500">总 Run 数</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{metrics.total}</div>
            </div>
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs font-bold text-emerald-700">SUCCESS</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700">{metrics.success}</div>
            </div>
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-bold text-amber-700">NEEDS_REVIEW</div>
              <div className="mt-1 text-2xl font-bold text-amber-700">{metrics.review}</div>
            </div>
            <div className="rounded border border-rose-200 bg-rose-50 p-3">
              <div className="text-xs font-bold text-rose-700">FAILED</div>
              <div className="mt-1 text-2xl font-bold text-rose-700">{metrics.failed}</div>
            </div>
            <div className="rounded border border-blue-200 bg-blue-50 p-3">
              <div className="text-xs font-bold text-blue-700">平均耗时</div>
              <div className="mt-1 text-2xl font-bold text-blue-700">{metrics.avg}ms</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold text-slate-900">最近 Run 列表</h3>
            <p className="mt-1 text-xs text-slate-500">点击任意 Run 查看完整执行步骤、Tool 调用与规则命中。</p>
          </div>
          {runs.length === 0 ? (
            <div className="flex min-h-[160px] items-center justify-center text-sm text-slate-400">
              暂无 Run，请到「对账治理 Agent 工作台」触发归因，或直接调用 POST /api/analyze。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => loadDetail(run.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-mono text-sm font-bold text-slate-900">{run.id}</div>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", statusStyles[run.status])}>
                          {run.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Skill: <span className="font-bold text-slate-700">{run.skillCode ?? "—"}</span>　·　
                        单据: <span className="font-mono font-bold text-slate-700">{run.billNo}</span>　·　
                        路由: <span className="text-slate-700">{run.reviewRoutes?.join("、") ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-6 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />
                      {run.stepCount} 步
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {run.durationMs ?? "—"}ms
                    </span>
                    {run.confidence != null && (
                      <span className="inline-flex items-center gap-1 font-bold text-blue-700">{run.confidence}%</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
              className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900">Run 详情</h3>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", statusStyles[selected.status])}>
                      {selected.status}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-slate-500">{selected.id}</div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6">
                {loadingDetail ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">加载中…</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                      <div>
                        <div className="text-xs text-slate-400">Agent</div>
                        <div className="mt-1 font-bold text-slate-900">{selected.agentCode}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Skill</div>
                        <div className="mt-1 font-bold text-slate-900">{selected.skillCode ?? "—"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">置信度</div>
                        <div className="mt-1 font-bold text-blue-700">{selected.confidence ?? "—"}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">首异常环节</div>
                        <div className="mt-1 font-bold text-slate-900">{selected.firstAbnormalNode ?? "—"}</div>
                      </div>
                    </div>

                    {selected.rootCause && (
                      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold text-slate-500">根因结论</div>
                        <div className="mt-2 text-sm leading-6 text-slate-700">{selected.rootCause}</div>
                      </div>
                    )}

                    <div className="mt-5">
                      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Database className="h-4 w-4 text-blue-600" />
                        执行步骤 Timeline
                      </div>
                      <div className="relative">
                        <div className="absolute left-4 top-1 h-full w-0.5 bg-slate-200" />
                        <ol className="space-y-3">
                          {selected.steps.map((step) => (
                            <li key={step.seq} className="relative pl-10">
                              <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-600">
                                {step.seq}
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <StepBadge stepType={step.stepType} />
                                    {step.toolName && (
                                      <span className="truncate font-mono text-xs text-slate-700">{step.toolName}</span>
                                    )}
                                    {step.ruleHit && (
                                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                        命中 {step.ruleHit}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {step.durationMs}ms
                                    </span>
                                    {step.passed === true && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                                  </div>
                                </div>
                                <div className="mt-2 text-xs leading-6 text-slate-600">{step.desc}</div>
                                <details className="mt-2 text-xs text-slate-500">
                                  <summary className="cursor-pointer font-bold text-slate-500 hover:text-slate-700">
                                    输入 / 输出 (脱敏摘要)
                                  </summary>
                                  <div className="mt-2 grid gap-2">
                                    <pre className="rounded bg-slate-50 p-2 font-mono text-[11px] leading-5 text-slate-600">
{`input  : ${formatJsonPreview(step.input)}`}
                                    </pre>
                                    <pre className="rounded bg-slate-50 p-2 font-mono text-[11px] leading-5 text-slate-600">
{`output : ${formatJsonPreview(step.output)}`}
                                    </pre>
                                  </div>
                                </details>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    {selected.reportText && (
                      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900 p-4 text-white">
                        <div className="mb-2 text-xs font-bold text-slate-300">脱敏模型报告</div>
                        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-100">{selected.reportText}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

