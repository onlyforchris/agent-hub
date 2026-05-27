import React from "react";
import { Cpu, ShieldAlert, Smartphone, Workflow } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { UiPanelCard, UiStatCard } from "@/src/components/ui/primitives.tsx";
import { cn } from "@/src/lib/utils.ts";

const chartTooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 30px rgb(0 0 0 / 0.08)",
  fontSize: 12,
};

function TrendBadge({ children, tone }: { children: React.ReactNode; tone: "up" | "down" | "neutral" }) {
  const cls =
    tone === "up"
      ? "text-emerald-600 bg-emerald-50"
      : tone === "down"
        ? "text-rose-600 bg-rose-50"
        : "text-slate-500 bg-slate-50";
  return <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-bold", cls)}>{children}</span>;
}

export function DashboardView() {
  const trendData = [
    { name: "周一", tasks: 400, tokens: 24 },
    { name: "周二", tasks: 600, tokens: 32 },
    { name: "周三", tasks: 550, tokens: 29 },
    { name: "周四", tasks: 800, tokens: 41 },
    { name: "周五", tasks: 950, tokens: 53 },
    { name: "周六", tasks: 400, tokens: 18 },
    { name: "周日", tasks: 300, tokens: 12 },
  ];

  const agentData = [
    { name: "对账治理", success: 85, error: 5 },
    { name: "财报解读", success: 42, error: 2 },
    { name: "智能客服", success: 120, error: 10 },
    { name: "审批路由", success: 65, error: 1 },
  ];

  const anomalyData = [
    { name: "金额不一致", value: 400, color: "#ef4444" },
    { name: "缺漏凭证", value: 300, color: "#f59e0b" },
    { name: "系统超时", value: 150, color: "#64748b" },
    { name: "权限拒绝", value: 100, color: "#8b5cf6" },
  ];

  return (
    <div className="ui-page-enter flex h-full flex-col gap-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-slate-800">全景数字化大盘</h1>
        <p className="text-sm text-slate-500">纵览 Agent 中台各项健康度指标、任务吞吐与模型用量。</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <UiStatCard
          label="总调度任务"
          value="14,230"
          icon={<Workflow className="h-6 w-6" />}
          iconClassName="bg-blue-50 text-blue-500"
          footer={<TrendBadge tone="up">+12.5% 较上周</TrendBadge>}
        />
        <UiStatCard
          label="API Token 消耗"
          value="4.2M"
          icon={<Cpu className="h-6 w-6" />}
          iconClassName="bg-purple-50 text-purple-500"
          footer={<TrendBadge tone="down">↑ 5.2% 较上周</TrendBadge>}
        />
        <UiStatCard
          label="平均响应延迟"
          value={
            <>
              320<span className="ml-1 text-lg text-slate-500">ms</span>
            </>
          }
          icon={<Smartphone className="h-6 w-6" />}
          iconClassName="bg-amber-50 text-amber-500"
          footer={<TrendBadge tone="up">-10ms 优化</TrendBadge>}
        />
        <UiStatCard
          label="异常拦截率"
          value="99.8%"
          icon={<ShieldAlert className="h-6 w-6" />}
          iconClassName="bg-rose-50 text-rose-500"
          footer={<TrendBadge tone="neutral">持平</TrendBadge>}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 xl:grid-cols-12">
        <UiPanelCard className="flex min-h-[400px] flex-col xl:col-span-7">
          <h3 className="mb-1 text-lg font-bold text-slate-800">任务与 Token 消耗趋势</h3>
          <p className="mb-4 text-xs text-slate-500">展示每日处理任务数及消耗的推理算力</p>
          <div className="min-h-[300px] flex-1 -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashColorTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashColorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ fontWeight: 700, color: "#1e293b" }} />
                <Area yAxisId="left" type="monotone" dataKey="tokens" stroke="#8b5cf6" strokeWidth={3} fill="url(#dashColorTokens)" name="Token(k)" />
                <Area yAxisId="right" type="monotone" dataKey="tasks" stroke="#3b82f6" strokeWidth={3} fill="url(#dashColorTasks)" name="任务数" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </UiPanelCard>

        <div className="flex flex-col gap-8 xl:col-span-5">
          <UiPanelCard className="flex min-h-[220px] flex-1 flex-col">
            <h3 className="mb-4 text-base font-bold text-slate-800">各 Agent 吞吐与异常</h3>
            <div className="min-h-[160px] flex-1 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentData} layout="vertical" margin={{ top: 0, right: 10, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} width={80} />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "#f8fafc" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="success" stackId="a" fill="#10b981" name="成功" maxBarSize={20} />
                  <Bar dataKey="error" stackId="a" fill="#f43f5e" name="异常" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </UiPanelCard>

          <UiPanelCard className="flex h-52 items-center">
            <div className="h-full min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={anomalyData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                    {anomalyData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex w-[46%] flex-col justify-center gap-3 pr-4">
              <h3 className="mb-1 border-b border-slate-100 pb-2 text-sm font-bold text-slate-800">常见异常类型分布</h3>
              {anomalyData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600">{d.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{d.value}</span>
                </div>
              ))}
            </div>
          </UiPanelCard>
        </div>
      </div>
    </div>
  );
}
