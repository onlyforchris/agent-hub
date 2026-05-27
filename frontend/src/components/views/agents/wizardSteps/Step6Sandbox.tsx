import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  PlayCircle,
  RefreshCcw,
  Sparkles,
  TerminalSquare,
  Waypoints,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils.ts";
import type {
  GatewayInfo,
  WizardFormState,
} from "@/src/components/views/agents/types.ts";

interface DiffRecord {
  id: string;
  billNo: string;
  type: "MDM_ID_ANOMALY" | "AMOUNT_DOUBLE" | "STATUS_MISMATCH";
  status: string;
  sapAmount: number;
  dmsAmount: number;
  diffAmount: number;
  module: string;
  desc?: string;
  businessLine?: string;
  ownerSystem?: string;
}

interface AnalyzeResult {
  success: boolean;
  runId?: string;
  skillName?: string;
  rootCause?: string;
  firstAbnormalNode?: string;
  confidence?: number;
  reviewSuggestion?: string;
  report?: string;
  error?: string;
  evidenceChain?: Array<unknown>;
  auditNotes?: string[];
}

const typeLabel: Record<DiffRecord["type"], string> = {
  MDM_ID_ANOMALY: "同结算单多 MDM ID",
  AMOUNT_DOUBLE: "收入金额翻倍",
  STATUS_MISMATCH: "SAP/DMS 状态回传不一致",
};

interface Props {
  form: WizardFormState;
  gateway: GatewayInfo | null;
}

export function Step6Sandbox({ form, gateway }: Props) {
  const [diffs, setDiffs] = useState<DiffRecord[]>([]);
  const [diffId, setDiffId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    fetch("/api/differences")
      .then((r) => r.json())
      .then((d: DiffRecord[]) => {
        setDiffs(d);
        if (d.length > 0) setDiffId(d[0].id);
      });
  }, []);

  const selected = useMemo(() => diffs.find((d) => d.id === diffId), [diffs, diffId]);

  const trigger = async () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    const t0 = Date.now();
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diffId: selected.id,
          billNo: selected.billNo,
          type: selected.type,
        }),
      });
      const data: AnalyzeResult = await resp.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setElapsed(Date.now() - t0);
      setRunning(false);
    }
  };

  const reset = () => {
    setResult(null);
    setElapsed(0);
  };

  return (
    <div className="w-full animate-in slide-in-from-bottom-4 space-y-5 p-4 duration-500 sm:p-5 xl:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <TerminalSquare className="h-5 w-5 text-indigo-600" />
              真沙盒：端到端调用 /api/analyze
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              直接从 fixture 差异清单中挑一条，复用工作台的真实 Runtime → Skill → Tool → Rule → Model → Review 链路。
              产生的 RunId 与「Agent 执行追踪」页一致。
            </p>
          </div>
          {result && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              重置
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              选择一条差异作为输入
            </label>
            <select
              value={diffId}
              onChange={(e) => setDiffId(e.target.value)}
              disabled={running}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {diffs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.billNo} · {typeLabel[d.type]} · diff=¥{d.diffAmount.toLocaleString()}
                </option>
              ))}
            </select>
            {selected && (
              <p className="mt-2 text-[11px] text-slate-500">
                业务线：{selected.businessLine}　|　责任系统：{selected.ownerSystem}　|　
                SAP/DMS：{selected.sapAmount.toLocaleString()} / {selected.dmsAmount.toLocaleString()}
                <br />
                {selected.desc}
              </p>
            )}
          </div>
          <div className="flex items-end">
            <button
              onClick={trigger}
              disabled={!selected || running}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              <PlayCircle className={cn("h-4 w-4", running && "animate-spin")} />
              {running ? "执行中…" : "启动真沙盒分析"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">
            Agent: <code className="font-mono">{form.name}</code>
          </span>
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">
            Skills: {form.selectedSkillCodes.length}
          </span>
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">
            Tools: {form.selectedToolNames.length}
          </span>
          <span
            className={cn(
              "rounded border px-2 py-0.5",
              gateway?.provider === "fallback_template"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            Provider: {gateway?.provider ?? "fallback_template"} ({gateway?.model ?? "—"})
          </span>
        </div>
      </div>

      {/* 运行中态 */}
      {running && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-2xl xl:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-rose-500" />
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="ml-2 font-mono text-xs text-slate-400">
              Agent Trace Shell · POST /api/analyze
            </span>
          </div>
          <div className="space-y-2 font-mono text-xs leading-6">
            <TerminalLine delay={0} color="text-indigo-300">
              [SYSTEM] booting Agent Runtime for diff={selected?.id}…
            </TerminalLine>
            <TerminalLine delay={0.3} color="text-blue-300">
              [PLANNER] match diff.type={selected?.type} → routing to skill…
            </TerminalLine>
            <TerminalLine delay={0.7} color="text-emerald-300">
              [TOOL_CALL] querying fixture connectors (DMS / SAP / Master)…
            </TerminalLine>
            <TerminalLine delay={1.1} color="text-emerald-300">
              [RULE] eval_amount_compare / detect_duplicate / eval_status_matrix…
            </TerminalLine>
            <TerminalLine delay={1.5} color="text-amber-300">
              [MODEL] Model Gateway → {gateway?.provider ?? "fallback_template"} · desensitized payload
            </TerminalLine>
            <TerminalLine delay={1.9} color="text-rose-300">
              [REVIEW_ROUTE] dispatching to {form.selectedSkillCodes.length > 0 ? "FINANCE_REVIEWER" : "—"}
            </TerminalLine>
          </div>
        </div>
      )}

      {/* 结果态 */}
      {!running && result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {result.error || !result.success ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-5 w-5" />
                分析失败
              </div>
              <p className="mt-2 text-sm">{result.error ?? "未知错误"}</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <div>
                    <div className="font-bold text-emerald-900">沙盒执行成功</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {elapsed} ms
                      </span>
                      <span className="rounded bg-white px-2 py-0.5 font-mono">
                        runId: {result.runId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    根因结论 (Skill: <code className="font-mono">{result.skillName}</code>)
                  </div>
                  <p className="text-sm leading-6 text-slate-700">{result.rootCause}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                      首次异常：{result.firstAbnormalNode ?? "—"}
                    </span>
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                      复核建议：{result.reviewSuggestion}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold text-slate-500">置信度</div>
                  <div className="text-4xl font-bold text-blue-700">{result.confidence}%</div>
                  <div className="text-xs text-slate-500">
                    证据链共 {Array.isArray(result.evidenceChain) ? result.evidenceChain.length : 0} 条记录已落入 Trace。
                  </div>
                </div>
              </div>

              {result.report && (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-white">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300">
                    <Database className="h-4 w-4 text-blue-300" />
                    Model Gateway 输出（脱敏）· {gateway?.provider ?? "fallback_template"}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-100">{result.report}</pre>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-indigo-700">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Waypoints className="h-4 w-4" />
                  RunId 已落库，可在「Agent 执行追踪」页面回放每一步
                </div>
                <a
                  href="#agent-trace"
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(
                      new CustomEvent("agent-hub-tab-switch", { detail: { tab: "runs" } }),
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  打开 Trace 页面
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </>
          )}
        </motion.div>
      )}

      {!running && !result && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          点击上方「启动真沙盒分析」按钮，会真正调用后端 <code className="rounded bg-white px-1 font-mono">POST /api/analyze</code>，
          产生的 Run 与 Trace 与生产环境逻辑完全一致；POC 阶段所有副作用 Tool 都被 Runtime 拦截，不会写真实业务系统。
        </div>
      )}
    </div>
  );
}

function TerminalLine({
  delay,
  color,
  children,
}: {
  delay: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={cn("text-slate-300", color)}
    >
      {children}
    </motion.div>
  );
}

