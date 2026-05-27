import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  Filter,
  GitBranch,
  RefreshCcw,
  Search,
  Server,
  ShieldAlert,
  TimerReset,
  X,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils.ts";
import type {
  BusinessSystem,
  InterfaceAlert,
  InterfaceDefinition,
  InterfaceLogRecord,
  InterfaceLogStatus,
  InterfaceMonitorSummary,
} from "@/src/types.ts";

const statusStyles: Record<string, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAIL: "border-rose-200 bg-rose-50 text-rose-700",
  TIMEOUT: "border-orange-200 bg-orange-50 text-orange-700",
  RETRYING: "border-blue-200 bg-blue-50 text-blue-700",
  open: "border-rose-200 bg-rose-50 text-rose-700",
  acknowledged: "border-amber-200 bg-amber-50 text-amber-700",
  resolved: "border-slate-200 bg-slate-50 text-slate-600",
};

const severityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
  critical: "bg-red-600 text-white",
};

const statusLabels: Record<string, string> = {
  healthy: "正常",
  warning: "关注",
  critical: "异常",
  SUCCESS: "成功",
  FAIL: "失败",
  TIMEOUT: "超时",
  RETRYING: "重试中",
  open: "待处理",
  acknowledged: "已确认",
  resolved: "已关闭",
};

const severityLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "紧急",
};

const frequencyLabels: Record<string, string> = {
  realtime: "实时",
  daily_batch: "每日批处理",
  manual: "手工触发",
};

const ingestionModeLabels: Record<string, string> = {
  API: "API 接入",
  ETL: "ETL 抽取",
  API_ETL: "API + ETL",
};

const logPageSize = 6;

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", statusStyles[value])}>
      {statusLabels[value] ?? value}
    </span>
  );
}

function formatTime(value?: string) {
  if (!value) return "-";
  return value.replace("T", " ").replace("+08:00", "");
}

function metricText(value: number, suffix = "") {
  return Number.isFinite(value) ? `${value}${suffix}` : `0${suffix}`;
}

export function InterfaceMonitorView() {
  const [summary, setSummary] = useState<InterfaceMonitorSummary | null>(null);
  const [systems, setSystems] = useState<BusinessSystem[]>([]);
  const [definitions, setDefinitions] = useState<InterfaceDefinition[]>([]);
  const [logs, setLogs] = useState<InterfaceLogRecord[]>([]);
  const [alerts, setAlerts] = useState<InterfaceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState("");
  const [selectedInterface, setSelectedInterface] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [businessKey, setBusinessKey] = useState("");
  const [selectedLog, setSelectedLog] = useState<InterfaceLogRecord | null>(null);
  const [logPage, setLogPage] = useState(1);

  const fetchJson = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${url}`);
    return res.json() as Promise<T>;
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSystem) params.set("system", selectedSystem);
      if (selectedInterface) params.set("interfaceCode", selectedInterface);
      if (selectedStatus) params.set("status", selectedStatus);
      if (businessKey) params.set("businessKey", businessKey);
      const query = params.toString();

      const [summaryData, systemData, definitionData, logData, alertData] = await Promise.all([
        fetchJson<InterfaceMonitorSummary>("/api/interface-monitor/summary"),
        fetchJson<BusinessSystem[]>("/api/interface-systems"),
        fetchJson<InterfaceDefinition[]>("/api/interface-definitions"),
        fetchJson<InterfaceLogRecord[]>(`/api/interface-logs${query ? `?${query}` : ""}`),
        fetchJson<InterfaceAlert[]>("/api/interface-alerts"),
      ]);
      setSummary(summaryData);
      setSystems(systemData);
      setDefinitions(definitionData);
      setLogs(logData);
      setLogPage(1);
      setAlerts(alertData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    await fetch(`/api/interface-alerts/${alertId}/ack`, { method: "POST" });
    await refreshAll();
  };

  const systemHealthMap = useMemo(() => {
    return new Map(summary?.systemHealth.map((item) => [item.systemCode, item]) ?? []);
  }, [summary]);

  const statusOptions: InterfaceLogStatus[] = ["SUCCESS", "FAIL", "TIMEOUT", "RETRYING"];
  const logPageCount = Math.max(1, Math.ceil(logs.length / logPageSize));
  const safeLogPage = Math.min(logPage, logPageCount);
  const visibleLogs = useMemo(() => {
    const start = (safeLogPage - 1) * logPageSize;
    return logs.slice(start, start + logPageSize);
  }, [logs, safeLogPage]);
  const logStart = logs.length === 0 ? 0 : (safeLogPage - 1) * logPageSize + 1;
  const logEnd = Math.min(safeLogPage * logPageSize, logs.length);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="scrollbar-default h-full min-w-0 overflow-auto bg-slate-50/60 p-4 xl:p-6">
      <div className="min-w-0 space-y-5 xl:space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Server className="h-6 w-6 text-blue-600" />
                接口日志监控
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                支持 API 或 ETL 接入 DMS、SAP 等业务系统接口日志，按昨日批次监控失败、超时与重试异常，并为后续对账归因提供可追溯证据。
              </p>
            </div>
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 self-start rounded border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              刷新
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-6">
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-bold text-slate-500">接口数</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{summary?.totalInterfaces ?? 0}</div>
            </div>
            <div className="rounded border border-blue-200 bg-blue-50 p-3">
              <div className="text-xs font-bold text-blue-700">昨日日志量</div>
              <div className="mt-1 text-2xl font-bold text-blue-700">{summary?.yesterdayLogCount ?? 0}</div>
            </div>
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs font-bold text-emerald-700">抽取成功率</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700">{metricText(summary?.successRate ?? 0, "%")}</div>
            </div>
            <div className="rounded border border-rose-200 bg-rose-50 p-3">
              <div className="text-xs font-bold text-rose-700">失败/超时</div>
              <div className="mt-1 text-2xl font-bold text-rose-700">{summary?.failureCount ?? 0}</div>
            </div>
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-bold text-amber-700">ETL 接口</div>
              <div className="mt-1 text-2xl font-bold text-amber-700">{summary?.etlInterfaceCount ?? 0}</div>
            </div>
            <div className="rounded border border-orange-200 bg-orange-50 p-3">
              <div className="text-xs font-bold text-orange-700">未处理告警</div>
              <div className="mt-1 text-2xl font-bold text-orange-700">{summary?.openAlerts ?? 0}</div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            最近抽取批次：
            <span className="font-mono font-bold text-slate-900">{summary?.latestBatchNo ?? "-"}</span>
            <span className="mx-2 text-slate-300">|</span>
            抽取时间：
            <span className="font-mono font-bold text-slate-900">{formatTime(summary?.latestExtractAt)}</span>
          </div>
        </section>

        <section className="rounded-lg border border-rose-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50/70 px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <Bell className="h-4 w-4 text-rose-600" />
                异常告警
              </h3>
              <p className="mt-1 text-xs text-slate-500">优先展示昨日批次中需要业务或 IT 关注的接口异常。</p>
            </div>
            <span className="rounded-full border border-rose-200 bg-white px-2 py-1 text-xs font-bold text-rose-700">
              {alerts.filter((alert) => alert.status === "open").length} 条待处理
            </span>
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {alert.status === "open" ? <ShieldAlert className="h-5 w-5 text-rose-600" /> : <CheckCircle2 className="h-5 w-5 text-amber-600" />}
                    <span className={cn("rounded px-2 py-1 text-[10px] font-bold", severityStyles[alert.severity])}>
                      {severityLabels[alert.severity]}风险
                    </span>
                  </div>
                  <StatusBadge value={alert.status} />
                </div>
                <h4 className="mt-4 font-bold text-slate-900">{alert.title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">{alert.reason}</p>
                <div className="mt-4 grid gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Eye className="h-3.5 w-3.5" />
                    {alert.interfaceName}
                  </div>
                  {alert.businessKey && (
                    <div className="flex items-center gap-2 font-mono text-slate-500">
                      <TimerReset className="h-3.5 w-3.5" />
                      {alert.businessKey}
                    </div>
                  )}
                  <div className="text-slate-400">责任角色：{alert.ownerRole}</div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    {alert.notifyChannels.includes("dingtalk") && <span className="rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700">钉钉</span>}
                    {alert.notifyChannels.includes("email") && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-600">邮件</span>}
                    {alert.notifyChannels.includes("in_app") && <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">站内</span>}
                  </div>
                  {alert.status === "open" ? (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      确认
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
                      <XCircle className="h-3.5 w-3.5" />
                      已确认
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-6 min-[1800px]:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.75fr)]">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <Database className="h-4 w-4 text-blue-600" />
                已接入业务系统
              </h3>
            </div>
            <div className="grid gap-4 p-5 lg:grid-cols-2 min-[1800px]:block min-[1800px]:divide-y min-[1800px]:divide-slate-100 min-[1800px]:p-0">
              {systems.map((system) => {
                const health = systemHealthMap.get(system.code);
                return (
                  <div key={system.code} className="rounded-lg border border-slate-100 bg-white p-4 min-[1800px]:rounded-none min-[1800px]:border-0 min-[1800px]:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-900">{system.name}</h4>
                          <StatusBadge value={health?.status ?? system.status} />
                        </div>
                        <div className="mt-1 font-mono text-xs text-slate-400">{system.code}</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div className="font-bold text-slate-700">{system.interfaceCount} 个接口</div>
                        <div className="mt-1">{metricText(health?.successRate ?? 100, "%")} 成功率</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                      <div className="rounded border border-slate-100 bg-slate-50 p-2">
                        <div className="text-slate-400">责任部门</div>
                        <div className="mt-1 font-bold text-slate-700">{system.ownerDept}</div>
                      </div>
                      <div className="rounded border border-slate-100 bg-slate-50 p-2">
                        <div className="text-slate-400">责任角色</div>
                        <div className="mt-1 font-bold text-slate-700">{system.ownerRole}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5" />
                      最近心跳 {formatTime(system.lastHeartbeatAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <GitBranch className="h-4 w-4 text-blue-600" />
                接口健康明细
              </h3>
            </div>
            <div className="scrollbar-default max-h-[520px] min-w-0 max-w-full overflow-x-auto overflow-y-auto overscroll-contain">
              <table className="w-full min-w-[1250px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[260px]" />
                  <col className="w-[150px]" />
                  <col className="w-[100px]" />
                  <col className="w-[120px]" />
                  <col className="w-[110px]" />
                  <col className="w-[160px]" />
                  <col className="w-[90px]" />
                  <col className="w-[80px]" />
                  <col className="w-[80px]" />
                  <col className="w-[100px]" />
                </colgroup>
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="px-5 py-3">接口</th>
                    <th className="px-5 py-3">链路</th>
                    <th className="px-5 py-3">对象</th>
                    <th className="px-5 py-3">接入方式</th>
                    <th className="px-5 py-3">频率</th>
                    <th className="px-5 py-3">最近批次</th>
                    <th className="px-5 py-3">SLA</th>
                    <th className="px-5 py-3">状态</th>
                    <th className="px-5 py-3">成功率</th>
                    <th className="px-5 py-3">平均耗时</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {definitions.map((definition) => {
                    const health = summary?.interfaceHealth.find((item) => item.interfaceCode === definition.code);
                    return (
                      <tr key={definition.code} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{definition.name}</div>
                          <div className="mt-1 font-mono text-xs text-slate-400">{definition.code}</div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-600">
                          {definition.sourceSystem} → {definition.targetSystem}
                        </td>
                        <td className="px-5 py-4 text-slate-600">{definition.businessObject}</td>
                        <td className="px-5 py-4 text-slate-600">{ingestionModeLabels[definition.ingestionMode]}</td>
                        <td className="px-5 py-4 text-slate-600">{frequencyLabels[definition.frequency]}</td>
                        <td className="px-5 py-4">
                          <div className="font-mono text-xs font-bold text-slate-700">{definition.latestBatchNo}</div>
                          <div className="mt-1 text-xs text-slate-400">{formatTime(definition.latestExtractAt)}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{definition.slaMinutes} 分钟</td>
                        <td className="px-5 py-4"><StatusBadge value={health?.status ?? "healthy"} /></td>
                        <td className="px-5 py-4 font-bold text-slate-700">{metricText(health?.successRate ?? 100, "%")}</td>
                        <td className="px-5 py-4 text-slate-600">{health?.avgDurationMs ?? 0}ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-900">
                <Search className="h-4 w-4 text-blue-600" />
                接口日志查看
              </h3>
              <p className="mt-1 text-xs text-slate-500">按系统、接口、状态和结算单号定位异常，可作为 Agent 归因证据。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSystem}
                onChange={(e) => setSelectedSystem(e.target.value)}
                className="h-9 rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600"
              >
                <option value="">全部系统</option>
                {systems.map((system) => <option key={system.code} value={system.code}>{system.code}</option>)}
              </select>
              <select
                value={selectedInterface}
                onChange={(e) => setSelectedInterface(e.target.value)}
                className="h-9 max-w-[220px] rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600"
              >
                <option value="">全部接口</option>
                {definitions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-9 rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600"
              >
                <option value="">全部状态</option>
                {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
              <input
                value={businessKey}
                onChange={(e) => setBusinessKey(e.target.value)}
                placeholder="结算单号"
                className="h-9 w-40 rounded border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-blue-400"
              />
              <button
                onClick={refreshAll}
                className="inline-flex h-9 items-center gap-1.5 rounded bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
              >
                <Filter className="h-3.5 w-3.5" />
                筛选
              </button>
            </div>
          </div>

          <div className="scrollbar-default max-h-[520px] min-w-0 max-w-full overflow-x-auto overflow-y-auto overscroll-contain">
            <table className="w-full min-w-[1260px] table-fixed text-left text-sm [&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:z-10 [&_td:last-child]:border-l [&_td:last-child]:border-slate-100 [&_td:last-child]:bg-white [&_td:last-child]:text-center [&_td:last-child]:shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)] [&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:z-10 [&_th:last-child]:border-l [&_th:last-child]:border-slate-100 [&_th:last-child]:bg-slate-50 [&_th:last-child]:text-center [&_th:last-child]:shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)]">
              <colgroup>
                <col className="w-[115px]" />
                <col className="w-[170px]" />
                <col className="w-[135px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[90px]" />
                <col className="w-[80px]" />
                <col className="w-[90px]" />
                <col className="w-[60px]" />
                <col className="w-[135px]" />
                <col className="w-[105px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-5 py-3">时间</th>
                  <th className="px-5 py-3">接口</th>
                  <th className="px-5 py-3">业务键</th>
                  <th className="px-5 py-3">链路</th>
                  <th className="px-5 py-3">接入方式</th>
                  <th className="px-5 py-3">日志日期</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">耗时</th>
                  <th className="px-5 py-3">重试</th>
                  <th className="px-5 py-3">错误</th>
                  <th className="px-5 py-3">证据摘要</th>
                  <th className="px-5 py-3">查看</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{formatTime(log.requestAt)}</td>
                    <td className="px-5 py-4">
                      <div className="line-clamp-2 font-bold text-slate-900">{log.interfaceName}</div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-400">{log.id}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">
                      <div className="truncate">{log.businessKey}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{log.sourceSystem} → {log.targetSystem}</td>
                    <td className="px-5 py-4 text-slate-600">{ingestionModeLabels[log.ingestionMode]}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{log.originalBizDate}</td>
                    <td className="px-5 py-4"><StatusBadge value={log.status} /></td>
                    <td className="px-5 py-4 text-slate-600">{log.durationMs}ms</td>
                    <td className="px-5 py-4 text-slate-600">{log.retryCount}</td>
                    <td className="px-5 py-4">
                      {log.errorCode ? (
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs font-bold text-rose-700">{log.errorCode}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">{log.errorMessage}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="truncate font-mono text-xs text-slate-500">{log.payloadDigest}</div>
                    </td>
                    <td className="px-3 py-4">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex h-8 w-16 items-center justify-center gap-1 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div>
              共 <span className="font-bold text-slate-700">{logs.length}</span> 条日志，
              当前显示 <span className="font-bold text-slate-700">{logStart}-{logEnd}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLogPage((page) => Math.max(1, page - 1))}
                disabled={safeLogPage <= 1}
                className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 bg-white px-2.5 font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                上一页
              </button>
              <span className="min-w-[4rem] text-center font-mono font-bold text-slate-700">
                {safeLogPage}/{logPageCount}
              </span>
              <button
                type="button"
                onClick={() => setLogPage((page) => Math.min(logPageCount, page + 1))}
                disabled={safeLogPage >= logPageCount}
                className="inline-flex h-8 items-center gap-1 rounded border border-slate-200 bg-white px-2.5 font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div
            className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">接口日志详情</h3>
                  <StatusBadge value={selectedLog.status} />
                </div>
                <div className="mt-1 font-mono text-xs text-slate-400">{selectedLog.id}</div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="scrollbar-default flex-1 overflow-auto p-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-bold text-slate-400">接口名称</div>
                    <div className="mt-1 font-bold text-slate-900">{selectedLog.interfaceName}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">业务单号</div>
                    <div className="mt-1 font-mono font-bold text-slate-900">{selectedLog.businessKey}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">调用链路</div>
                    <div className="mt-1 font-mono font-bold text-slate-700">
                      {selectedLog.sourceSystem} → {selectedLog.targetSystem}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">请求时间</div>
                    <div className="mt-1 font-mono text-slate-700">{formatTime(selectedLog.requestAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">响应时间</div>
                    <div className="mt-1 font-mono text-slate-700">{formatTime(selectedLog.responseAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">耗时 / 重试次数</div>
                    <div className="mt-1 font-bold text-slate-700">
                      {selectedLog.durationMs}ms / {selectedLog.retryCount} 次
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">接入方式</div>
                    <div className="mt-1 font-bold text-slate-700">{ingestionModeLabels[selectedLog.ingestionMode]}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">抽取批次</div>
                    <div className="mt-1 font-mono font-bold text-slate-700">{selectedLog.batchNo}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">抽取时间</div>
                    <div className="mt-1 font-mono text-slate-700">{formatTime(selectedLog.extractedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-400">原始日志日期</div>
                    <div className="mt-1 font-mono text-slate-700">{selectedLog.originalBizDate}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="flex items-center gap-2 font-bold text-slate-900">
                  {selectedLog.errorCode ? (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  处理结论
                </h4>
                {selectedLog.errorCode ? (
                  <div className="mt-3 rounded border border-rose-100 bg-rose-50 p-3">
                    <div className="font-mono text-xs font-bold text-rose-700">{selectedLog.errorCode}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">{selectedLog.errorMessage}</div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    本次接口调用成功，未发现超时、失败或重试异常。
                  </p>
                )}
              </div>

              <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <h4 className="flex items-center gap-2 font-bold text-blue-900">
                  <ShieldAlert className="h-4 w-4 text-blue-700" />
                  对账归因可用证据
                </h4>
                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                  <p>
                    该日志来自业务系统接口日志台账，可按业务单号与差异单关联，作为判断“业务系统状态未同步、回传失败、接口超时或主数据缺失”的依据。
                  </p>
                  <div className="rounded border border-blue-100 bg-white p-3">
                    <div className="text-xs font-bold text-slate-400">数据来源说明</div>
                    <div className="mt-1 text-sm text-slate-700">
                      来源系统：{selectedLog.sourceSystem} / {selectedLog.targetSystem} 接口日志；接入方式：
                      {ingestionModeLabels[selectedLog.ingestionMode]}；抽取批次：{selectedLog.batchNo}。
                    </div>
                  </div>
                  <div className="rounded border border-blue-100 bg-white p-3">
                    <div className="text-xs font-bold text-slate-400">脱敏报文摘要</div>
                    <div className="mt-1 break-all font-mono text-xs text-slate-700">{selectedLog.payloadDigest}</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded border border-blue-100 bg-white p-3">
                      <div className="text-xs font-bold text-slate-400">关联差异单</div>
                      <div className="mt-1 font-mono font-bold text-slate-700">{selectedLog.relatedDiffId ?? "暂无"}</div>
                    </div>
                    <div className="rounded border border-blue-100 bg-white p-3">
                      <div className="text-xs font-bold text-slate-400">关联 Agent Run</div>
                      <div className="mt-1 font-mono font-bold text-slate-700">{selectedLog.relatedRunId ?? "待归因时生成"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-900 p-4 text-white">
                <h4 className="font-bold">建议处理动作</h4>
                <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-300">
                  {selectedLog.status === "SUCCESS" && <div>无需处理，可作为链路正常的佐证。</div>}
                  {selectedLog.status === "RETRYING" && <div>关注下一次重试结果，超过 SLA 后通知接口责任人。</div>}
                  {selectedLog.status === "TIMEOUT" && <div>优先检查目标系统响应时间、网络链路和批处理窗口占用情况。</div>}
                  {selectedLog.status === "FAIL" && <div>根据错误码定位责任系统，必要时由业务复核该单据状态。</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

