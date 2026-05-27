import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  CpuIcon,
  Database,
  Plus,
  RefreshCcw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils.ts";
import type {
  AgentMeta,
  HealthzInfo,
  RunSummaryApi,
} from "@/src/components/views/agents/types.ts";

const statusBadge: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  online: { label: "已上架", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  planning: { label: "规划中", cls: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock },
  paused: { label: "已下线", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
};

const providerLabel: Record<string, string> = {
  deepseek: "DeepSeek V4 Flash",
  qwen: "Qwen Max",
  fallback_template: "本地兜底模板",
};

const executionModeLabel: Record<string, string> = {
  workflow: "工作流模式",
  plan_execute: "计划-执行模式",
  react: "自主推理模式",
};

export function AgentList({ onSelect }: { onSelect: (id: string) => void }) {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [runs, setRuns] = useState<RunSummaryApi[]>([]);
  const [health, setHealth] = useState<HealthzInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [a, r, h] = await Promise.all([
        fetch("/api/agents").then((res) => res.json()),
        fetch("/api/runs").then((res) => res.json()),
        fetch("/api/healthz").then((res) => res.json()),
      ]);
      setAgents(a);
      setRuns(r);
      setHealth(h);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onlineCount = useMemo(() => agents.filter((a) => a.status === "online").length, [agents]);
  const totalRuns = runs.length;
  const reviewCount = runs.filter((r) => r.status === "NEEDS_REVIEW").length;
  const avgConf =
    runs.length === 0
      ? 0
      : Math.round(runs.reduce((s, r) => s + (r.confidence ?? 0), 0) / runs.length);

  return (
    <div className="flex h-full flex-col bg-slate-50/50 p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Agent 编排与配置</h2>
          <p className="mt-1 text-sm text-slate-500">
            中台所有场景 Agent 的注册、能力挂载和发布入口；POC 阶段已上架 1 个，二/三期规划 3 个。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            刷新
          </button>
          <button
            onClick={() => onSelect("new")}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> 新增场景 Agent
          </button>
        </div>
      </div>

      {/* 顶部运行态指标 */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard label="在线 Agent" value={onlineCount} icon={Bot} tone="blue" />
        <MetricCard label="累计 Run 数" value={totalRuns} icon={Activity} tone="indigo" />
        <MetricCard label="待复核" value={reviewCount} icon={Clock} tone="amber" />
        <MetricCard label="平均置信度" value={`${avgConf}%`} icon={Sparkles} tone="emerald" />
        <MetricCard
          label="模型 Provider"
          value={health ? providerLabel[health.gateway.provider] ?? health.gateway.provider : "—"}
          icon={CpuIcon}
          tone={health?.gateway.provider === "fallback_template" ? "slate" : "rose"}
          small
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const status = statusBadge[agent.status] ?? statusBadge.planning;
          const StatusIcon = status.icon;
          const isOnline = agent.status === "online";
          return (
            <motion.div
              key={agent.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={isOnline ? { y: -2 } : undefined}
              className={cn(
                "group flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm transition-all",
                isOnline
                  ? "border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer"
                  : "border-dashed border-slate-200 opacity-90",
              )}
              onClick={() => {
                if (isOnline) onSelect(agent.code);
              }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    isOnline
                      ? "border-blue-100 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                      : "border-slate-200 bg-slate-50 text-slate-400",
                  )}
                >
                  <Bot className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold",
                    status.cls,
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </span>
              </div>
              <h3 className="mb-1 truncate font-bold text-slate-900">{agent.displayName}</h3>
              <div className="mb-2 text-[10px] text-slate-400">
                <code className="font-mono">{agent.code}</code>
                <span className="ml-2">{agent.version}</span>
                <span className="ml-2">· {agent.owner}</span>
              </div>
              <p className="mb-4 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">
                {agent.description}
              </p>

              {agent.metrics ? (
                <div className="mb-4 grid grid-cols-3 gap-2 rounded border border-slate-100 bg-slate-50 p-2 text-center">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Runs</div>
                    <div className="mt-0.5 text-sm font-bold text-slate-800">{agent.metrics.totalRuns}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">置信</div>
                    <div className="mt-0.5 text-sm font-bold text-blue-700">{agent.metrics.avgConfidence}%</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">复核</div>
                    <div className="mt-0.5 text-sm font-bold text-amber-700">{agent.metrics.reviewCount}</div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-400">
                  暂未产生 Run，等待立项启动
                </div>
              )}

              <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="h-3 w-3 text-cyan-500" />
                    {agent.defaultSkills.length} Skills
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Database className="h-3 w-3 text-indigo-500" />
                    {executionModeLabel[agent.executionMode] ?? agent.executionMode}
                  </span>
                </div>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                    进入编排 <ArrowRight className="h-3 w-3" />
                  </span>
                ) : (
                  <span className="text-slate-400">即将开放</span>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* 新建占位卡片 */}
        <div
          onClick={() => onSelect("new")}
          className="group flex h-full min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition-all hover:border-blue-400 hover:bg-white hover:shadow-sm"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors group-hover:border-blue-200 group-hover:text-blue-600">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="mb-1 font-bold text-slate-700 transition-colors group-hover:text-blue-600">
            新建 Agent
          </h3>
          <p className="max-w-[220px] text-xs text-slate-500">
            从空白模板开始，按 6 步向导挂载 Skill / Tool / 模型 / 沙箱边界。
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  small,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: "blue" | "indigo" | "amber" | "emerald" | "rose" | "slate";
  small?: boolean;
}) {
  const toneMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <div className={cn("rounded-lg border p-3 shadow-sm", toneMap[tone])}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("mt-1 font-bold", small ? "text-sm" : "text-2xl")}>{value}</div>
    </div>
  );
}

