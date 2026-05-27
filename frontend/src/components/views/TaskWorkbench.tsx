import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  CheckSquare,
  Clock,
  Eye,
  Filter,
  PlayCircle,
  RotateCcw,
  Send,
  Square,
  Timer,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { AnalysisResult, ReconciliationCategory, ReconciliationDifference } from "@/src/types.ts";
import { cn } from "@/src/lib/utils.ts";
import { syncAppUrlParams } from "@/src/lib/urlParams.ts";
import type { AppViewMode } from "../RoleSwitcher.tsx";
import { BatchAnalyzeModal, type BatchAnalyzeProgress } from "./workbench/BatchAnalyzeModal.tsx";
import { DiffDetailDrawer, type CollaborationDispatchPayload, type PushRecord } from "./workbench/DiffDetailDrawer.tsx";
import { DingTalkPushModal } from "./workbench/DingTalkPushModal.tsx";
import { WorkbenchStatusPanel } from "./workbench/WorkbenchStatusPanel.tsx";
import {
  analysisProgressSteps,
  attributionResultLabels,
  attributionResultStyles,
  governanceLevelColors,
  processingGroups,
  reconciliationTypeColors,
  reconciliationTypeLabels,
  statusLabels,
  statusStyles,
  typeLabels,
  type TodoFilter,
  type WorkbenchTab,
} from "./workbench/constants.ts";
import {
  batchProgressStats,
  getSLATier,
  getTimeRemaining,
  sortBySLAUrgency,
  sortWorkbenchDiffs,
} from "./workbench/workbenchUtils.ts";
import demoDifferencesRaw from "@/agent/connectors/fixtures/diffs.json";

interface TaskWorkbenchProps {
  initialTab?: WorkbenchTab;
  initialBillNo?: string | null;
  roleMode?: AppViewMode;
}

const DIFF_STATE_STORAGE_KEY = "agent_hub_diff_state_v1";
const PUSH_RECORD_STORAGE_KEY = "agent_hub_push_records_v1";
const FLOW_RESET_ONCE_KEY = "agent_hub_flow_reset_once_v1";

const demoDifferences = demoDifferencesRaw as ReconciliationDifference[];
const pageSize = 5;

const diffSeedById = new Map(demoDifferences.map((item) => [item.id, item] as const));

function hydrateDiffDetails(item: ReconciliationDifference): ReconciliationDifference {
  const seed = diffSeedById.get(item.id);
  if (!seed) return item;
  return {
    ...seed,
    ...item,
    sapDetail: item.sapDetail ?? seed.sapDetail,
    dmsDetail: item.dmsDetail ?? seed.dmsDetail,
    integrationLogs: item.integrationLogs ?? seed.integrationLogs,
  };
}

function cloneDifferences(items: ReconciliationDifference[]) {
  return items.map((item) => ({ ...hydrateDiffDetails(item) }));
}

function resetDiffHistoryForRetest(item: ReconciliationDifference): ReconciliationDifference {
  return {
    ...item,
    processingLogs: [],
    processingGroupId: undefined,
    processingGroupName: undefined,
    handlerId: undefined,
    handlerName: undefined,
    assignedAt: undefined,
  };
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

function savePersistedDiffState(map: Record<string, Partial<ReconciliationDifference>>) {
  try {
    localStorage.setItem(DIFF_STATE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors in POC mode
  }
}

function loadPersistedPushRecords(): Record<string, PushRecord> {
  try {
    const raw = localStorage.getItem(PUSH_RECORD_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PushRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isClosed(diff: ReconciliationDifference) {
  return diff.status === "COMPLETED" || diff.status === "CONFIRMED" || diff.status === "PROCESSED";
}

function isFinanceNormalRecord(diff: ReconciliationDifference) {
  return isClosed(diff) && (diff.attributionResult === "NO_DIFFERENCE_FALSE_ALARM" || diff.diffAmount === 0);
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

function workbenchCopy(roleMode?: AppViewMode) {
  if (roleMode === "sap") {
    return {
      title: "SAP 对账差异处理台",
      subtitle: "仅展示已转派给 SAP 处理组的差异任务，重点补充处理意见并回传财务复核。",
      listTitle: "SAP 待处理差异",
      listHelp: "按 SLA、金额与等待时长排序；处理完成后回传财务复核。",
    };
  }
  if (roleMode === "dms") {
    return {
      title: "DMS 对账差异处理台",
      subtitle: "仅展示已转派给 DMS 处理组的差异任务，重点补充处理意见并回传财务复核。",
      listTitle: "DMS 待处理差异",
      listHelp: "按 SLA、金额与等待时长排序；处理完成后回传财务复核。",
    };
  }
  return {
    title: "财务对账差异处理台",
    subtitle: "承接帆软对账差异，在此完成归因分析、证据核对、责任转派、复核确认与治理沉淀。",
    listTitle: "对账差异清单",
    listHelp: "按 SLA、金额与等待时长排序；可直接启动归因、查看报告或跟进处理状态。",
  };
}

function nextActionMeta(label: string) {
  if (label.includes("启动") || label.includes("归因")) return { icon: PlayCircle, tone: "bg-blue-600 hover:bg-blue-700 text-white" };
  if (label.includes("重新")) return { icon: RotateCcw, tone: "bg-blue-600 hover:bg-blue-700 text-white" };
  if (label.includes("催办") || label.includes("提交") || label.includes("转")) return { icon: Send, tone: "bg-violet-600 hover:bg-violet-700 text-white" };
  if (label.includes("确认") || label.includes("复核")) return { icon: CheckCircle2, tone: "bg-emerald-600 hover:bg-emerald-700 text-white" };
  return { icon: Eye, tone: "bg-blue-600 hover:bg-blue-700 text-white" };
}

function nextActionHint(diff: ReconciliationDifference, pushRecord?: PushRecord) {
  if (pushRecord && (diff.status === "FORWARDED_TO_BUSINESS" || diff.status === "BUSINESS_PROCESSING" || diff.status === "EVIDENCE_GATHERING")) {
    return `已推送 ${pushRecord.assignee}，等待责任方处理或反馈`;
  }
  switch (diff.status) {
    case "PENDING":
    case "PENDING_ATTRIBUTION":
      return "待启动归因，建议优先处理高金额或 SLA 风险项";
    case "ATTRIBUTING":
      return "系统正在归因，可进入详情查看当前排查进度";
    case "NEEDS_REVIEW":
    case "FINANCE_CONFIRMED":
      return "归因报告已生成，等待财务确认或转派责任方";
    case "INSUFFICIENT_EVIDENCE_CLOSED":
      return "证据不足已结案，进入治理台账，可按重开条件再次发起";
    case "FORWARDED_TO_BUSINESS":
      return "已转责任方，关注认领和处理反馈";
    case "BUSINESS_PROCESSING":
      return "责任方处理中，关注 SLA 与补充证据";
    case "BUSINESS_FEEDBACK":
    case "FINANCE_REVIEWING":
      return "责任方已反馈，等待财务终审";
    default:
      return "查看详情、证据链和处理记录";
  }
}

function StatusPill({ diff, pushRecord }: { diff: ReconciliationDifference; pushRecord?: PushRecord }) {
  const waitingByPush =
    pushRecord && (diff.status === "FORWARDED_TO_BUSINESS" || diff.status === "BUSINESS_PROCESSING" || diff.status === "EVIDENCE_GATHERING");
  const label = waitingByPush ? "待责任方处理" : statusLabels[diff.status] ?? diff.status;
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", statusStyles[diff.status] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
      {label}
    </span>
  );
}

function DiffListItem({
  diff,
  selected,
  pushRecord,
  selectable,
  checked,
  onToggleCheck,
  onSelect,
  primaryLabel,
  onPrimaryAction,
}: {
  diff: ReconciliationDifference;
  selected: boolean;
  pushRecord?: PushRecord;
  selectable?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
  onSelect: () => void;
  primaryLabel: string;
  onPrimaryAction: () => void;
}) {
  const tier = getSLATier(diff);
  const timeInfo = getTimeRemaining(diff);
  const action = nextActionMeta(primaryLabel);
  const ActionIcon = action.icon;
  const slaIcon = tier === "overdue"
    ? <AlertTriangle className="h-3 w-3 text-rose-500" />
    : tier === "warning"
      ? <Clock className="h-3 w-3 text-amber-500" />
      : <Timer className="h-3 w-3 text-emerald-500" />;
  const slaColor = tier === "overdue" ? "text-rose-600" : tier === "warning" ? "text-amber-600" : "text-emerald-600";

  return (
    <div className={cn("flex w-full border-l-4 transition-colors hover:bg-slate-50", selected ? "border-blue-600 bg-blue-50/40" : "border-transparent")}>
      {selectable && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCheck?.();
          }}
          aria-label={checked ? "取消选择" : "选择"}
          className="flex shrink-0 items-start px-3 pt-5 text-slate-400 hover:text-blue-600"
        >
          {checked ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
        </button>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className="block min-w-0 flex-1 cursor-pointer px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_220px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{diff.billNo}</span>
              {diff.governanceLevel && (
                <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-bold", governanceLevelColors[diff.governanceLevel])}>
                  {diff.governanceLevel}
                </span>
              )}
              <StatusPill diff={diff} pushRecord={pushRecord} />
              {diff.attributionResult && (
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", attributionResultStyles[diff.attributionResult])}>
                  {attributionResultLabels[diff.attributionResult]}
                </span>
              )}
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{diff.desc}</div>
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-700">
              <span className="font-bold text-blue-700">下一步：</span>
              {nextActionHint(diff, pushRecord)}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 xl:items-end">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">当前主操作</div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPrimaryAction();
              }}
              className={cn("inline-flex min-w-[104px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold shadow-sm", action.tone)}
            >
              <ActionIcon className="h-3.5 w-3.5" />
              {primaryLabel}
            </button>
            {pushRecord && <span className="text-[10px] text-slate-400">推送时间：{pushRecord.pushedAt}</span>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
          <div>
            <div className="text-slate-400">差异类型</div>
            <div className="mt-1 font-bold text-slate-700">{typeLabels[diff.type] ?? diff.type}</div>
          </div>
          <div>
            <div className="text-slate-400">差异金额</div>
            <div className="mt-1 font-mono font-bold text-slate-700">¥{diff.diffAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400">责任系统</div>
            <div className="mt-1 font-bold text-slate-700">{diff.ownerSystem ?? "-"}</div>
          </div>
          <div>
            <div className="text-slate-400">SLA</div>
            <div className={cn("mt-1 flex items-center gap-1 font-bold", slaColor)}>
              {slaIcon}
              {timeInfo.label} {timeInfo.hours}h
            </div>
          </div>
          <div>
            <div className="text-slate-400">对账类型</div>
            {diff.reconciliationType ? (
              <span className={cn("mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold", reconciliationTypeColors[diff.reconciliationType])}>
                {reconciliationTypeLabels[diff.reconciliationType]}
              </span>
            ) : (
              <div className="mt-1 font-bold text-slate-700">-</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskWorkbench({ initialTab, initialBillNo, roleMode = "finance" }: TaskWorkbenchProps) {
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>(initialTab ?? "todo");
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");
  const [reconTypeFilter, setReconTypeFilter] = useState<ReconciliationCategory | "all">("all");
  const [slaFilter, setSlaFilter] = useState<"all" | "normal" | "warning" | "overdue">("all");
  const [page, setPage] = useState(1);
  const [differences, setDifferences] = useState<ReconciliationDifference[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<ReconciliationDifference | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<string, AnalysisResult>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStepIndex, setProgressStepIndex] = useState(0);
  const [pushRecords, setPushRecords] = useState<Record<string, PushRecord>>(() => loadPersistedPushRecords());
  const [pushModal, setPushModal] = useState<{ diff: ReconciliationDifference; assignee: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchAnalyzeProgress>({ current: 0, total: 0, billNo: "", done: [], failed: [] });
  const progressTimerRef = useRef<number | null>(null);
  const isBusinessProcessor = roleMode === "sap" || roleMode === "dms";
  const copy = workbenchCopy(roleMode);

  useEffect(() => {
    try {
      const hasReset = localStorage.getItem(FLOW_RESET_ONCE_KEY) === "1";
      if (!hasReset) {
        localStorage.removeItem(DIFF_STATE_STORAGE_KEY);
        localStorage.removeItem(PUSH_RECORD_STORAGE_KEY);
        localStorage.removeItem("analysis_cache_v1");
        localStorage.setItem(FLOW_RESET_ONCE_KEY, "1");
        setPushRecords({});
        setAnalysisCache({});
        setAnalysisResult(null);
        setCheckedIds(new Set());
      }
    } catch {
      // ignore storage errors in POC mode
    }
  }, []);

  useEffect(() => {
    if (initialTab) setWorkbenchTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setPage(1);
  }, [workbenchTab, todoFilter, reconTypeFilter, slaFilter, roleMode]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/differences")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        return res.json() as Promise<ReconciliationDifference[]>;
      })
      .then((data) => {
        if (cancelled) return;
        const base = cloneDifferences(Array.isArray(data) && data.length > 0 ? data : demoDifferences).map(resetDiffHistoryForRetest);
        const persisted = loadPersistedDiffState();
        const merged = base.map((item) => (persisted[item.id] ? { ...item, ...persisted[item.id] } : item));
        setDifferences(merged);
      })
      .catch((error) => {
        console.warn(error);
        if (cancelled) return;
        const base = cloneDifferences(demoDifferences).map(resetDiffHistoryForRetest);
        const persisted = loadPersistedDiffState();
        const merged = base.map((item) => (persisted[item.id] ? { ...item, ...persisted[item.id] } : item));
        setDifferences(merged);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (differences.length === 0) return;
    const map: Record<string, Partial<ReconciliationDifference>> = {};
    differences.forEach((item) => {
      map[item.id] = {
        status: item.status,
        processingGroupId: item.processingGroupId,
        processingGroupName: item.processingGroupName,
        handlerId: item.handlerId,
        handlerName: item.handlerName,
        assignedAt: item.assignedAt,
        processingLogs: item.processingLogs,
      };
    });
    savePersistedDiffState(map);
  }, [differences]);

  useEffect(() => {
    try {
      localStorage.setItem(PUSH_RECORD_STORAGE_KEY, JSON.stringify(pushRecords));
    } catch {
      // ignore storage errors in POC mode
    }
  }, [pushRecords]);

  useEffect(() => {
    if (!isBusinessProcessor || differences.length === 0) return;
    setPushRecords((prev) => {
      const next = { ...prev };
      differences
        .filter((diff) => !isClosed(diff) && assignedToRole(diff, roleMode))
        .forEach((diff) => {
          if (!next[diff.id]) {
            next[diff.id] = {
              assignee: diff.processingGroupName ?? (roleMode === "sap" ? "SAP 处理组" : "DMS 处理组"),
              pushedAt: diff.assignedAt ?? "2026/5/22 09:30:00",
            };
          }
        });
      return next;
    });
  }, [differences, isBusinessProcessor, roleMode]);

  const scopedDifferences = useMemo(() => {
    if (!isBusinessProcessor) return differences;
    return differences.filter((diff) => assignedToRole(diff, roleMode) && visibleToBusinessRole(diff));
  }, [differences, isBusinessProcessor, roleMode]);

  const metrics = useMemo(() => ({
    pending: scopedDifferences.filter((d) => d.status === "PENDING_ATTRIBUTION" || d.status === "PENDING").length,
    attributing: scopedDifferences.filter((d) => d.status === "ATTRIBUTING").length,
    evidenceGathering: scopedDifferences.filter((d) => d.status === "EVIDENCE_GATHERING" || d.status === "INSUFFICIENT_EVIDENCE").length,
    review: scopedDifferences.filter((d) => d.status === "NEEDS_REVIEW" || d.status === "FINANCE_CONFIRMED" || d.status === "FINANCE_REVIEWING").length,
    insufficient: scopedDifferences.filter((d) => d.status === "INSUFFICIENT_EVIDENCE_CLOSED").length,
    forwarded: scopedDifferences.filter((d) => d.status === "FORWARDED_TO_BUSINESS").length,
    businessProcessing: scopedDifferences.filter((d) => d.status === "BUSINESS_PROCESSING").length,
    businessFeedback: scopedDifferences.filter((d) => d.status === "BUSINESS_FEEDBACK").length,
    completed: scopedDifferences.filter(isClosed).length,
    awaitingConfirm: scopedDifferences.filter((d) => pushRecords[d.id] && !isClosed(d)).length,
    slaOverdue: scopedDifferences.filter((d) => getSLATier(d) === "overdue" && !isClosed(d)).length,
    slaWarning: scopedDifferences.filter((d) => getSLATier(d) === "warning" && !isClosed(d)).length,
  }), [scopedDifferences, pushRecords]);
  const normalCount = scopedDifferences.filter(isFinanceNormalRecord).length;
  const processingCount = metrics.review + metrics.forwarded + metrics.businessProcessing + metrics.businessFeedback;

  const batchLabel = scopedDifferences[0]?.createdAtLabel ?? "2026-04 月结批次";
  const pushIdSet = useMemo(() => new Set(Object.keys(pushRecords)), [pushRecords]);
  const batchStats = useMemo(() => batchProgressStats(scopedDifferences, pushIdSet), [scopedDifferences, pushIdSet]);
  const todoCount = metrics.pending + metrics.attributing + metrics.evidenceGathering + metrics.review + metrics.insufficient + metrics.forwarded + metrics.businessProcessing + metrics.businessFeedback;

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearProgressTimer(), [clearProgressTimer]);

  const startProgressAnimation = useCallback(() => {
    clearProgressTimer();
    setProgressStepIndex(0);
    progressTimerRef.current = window.setInterval(() => {
      setProgressStepIndex((prev) => {
        if (prev >= analysisProgressSteps.length - 1) {
          clearProgressTimer();
          return prev;
        }
        return prev + 1;
      });
    }, 550);
  }, [clearProgressTimer]);

  const analyze = useCallback(async (diff: ReconciliationDifference, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setSelectedDiff(diff);
      setAnalysisResult(null);
      setIsAnalyzing(true);
      startProgressAnimation();
    }
    setDifferences((prev) => prev.map((item) => (
      item.id === diff.id && (item.status === "PENDING_ATTRIBUTION" || item.status === "PENDING")
        ? { ...item, status: "ATTRIBUTING" }
        : item
    )));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diffId: diff.id, billNo: diff.billNo, type: diff.type }),
      });
      const data = await response.json();
      if (!options?.silent) {
        clearProgressTimer();
        setProgressStepIndex(analysisProgressSteps.length - 1);
      }
      if (!response.ok || data.error) {
        if (!options?.silent) setAnalysisResult({ error: data.error || "分析失败，请检查服务状态。" });
        return { ok: false as const, error: data.error as string | undefined };
      }

      setAnalysisCache((prev) => ({ ...prev, [diff.id]: data }));
      setDifferences((prev) => prev.map((item) => (
        item.id === diff.id && ["ATTRIBUTING", "PENDING_ATTRIBUTION", "PENDING"].includes(item.status)
          ? { ...item, status: "NEEDS_REVIEW" }
          : item
      )));
      setSelectedDiff((prev) => (prev?.id === diff.id ? { ...prev, status: "NEEDS_REVIEW" } : prev));
      if (!options?.silent) setAnalysisResult(data);
      return { ok: true as const, data };
    } catch (error) {
      console.error(error);
      if (!options?.silent) {
        clearProgressTimer();
        setAnalysisResult({ error: "网络错误，分析请求未成功抵达服务端。" });
      }
      return { ok: false as const, error: "网络错误" };
    } finally {
      if (!options?.silent) setIsAnalyzing(false);
    }
  }, [clearProgressTimer, startProgressAnimation]);

  const pendingForBatch = useMemo(() => scopedDifferences.filter((d) => d.status === "PENDING_ATTRIBUTION" || d.status === "PENDING"), [scopedDifferences]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBatchAnalyze = async (targets: ReconciliationDifference[]) => {
    if (targets.length === 0) return;
    setBatchModalOpen(true);
    setBatchRunning(true);
    setBatchProgress({ current: 0, total: targets.length, billNo: "", done: [], failed: [] });
    const done: string[] = [];
    const failed: string[] = [];

    for (let index = 0; index < targets.length; index += 1) {
      const diff = targets[index];
      setBatchProgress((prev) => ({ ...prev, current: index, billNo: diff.billNo }));
      const result = await analyze(diff, { silent: true });
      if (result.ok) done.push(diff.billNo);
      else failed.push(diff.billNo);
      setBatchProgress((prev) => ({ ...prev, current: index + 1, billNo: diff.billNo, done: [...done], failed: [...failed] }));
    }

    setBatchRunning(false);
    setCheckedIds(new Set());
    showToast(`批量归因完成：成功 ${done.length} 笔${failed.length ? `，失败 ${failed.length} 笔` : ""}`);
  };

  const batchAnalyzeChecked = () => {
    const targets = scopedDifferences.filter((d) => checkedIds.has(d.id) && (d.status === "PENDING_ATTRIBUTION" || d.status === "PENDING"));
    if (targets.length === 0) {
      showToast("请先勾选待归因的差异。");
      return;
    }
    void runBatchAnalyze(targets);
  };

  const openDetail = useCallback((diff: ReconciliationDifference) => {
    setSelectedDiff(hydrateDiffDetails(diff));
    setAnalysisResult(analysisCache[diff.id] ?? null);
    setDetailOpen(true);
    if ((diff.status === "NEEDS_REVIEW" || diff.status === "FINANCE_CONFIRMED") && !analysisCache[diff.id]) {
      void analyze(diff);
    }
  }, [analysisCache, analyze]);

  const updateReviewStatus = (status: string) => {
    if (!selectedDiff) return;
    setDifferences((prev) => prev.map((item) => (item.id === selectedDiff.id ? { ...item, status } : item)));
    setSelectedDiff((prev) => (prev ? { ...prev, status } : prev));
    showToast(
      status === "CONFIRMED" || status === "PROCESSED"
        ? "归因已确认，已沉淀为历史案例。"
        : status === "INSUFFICIENT_EVIDENCE_CLOSED"
          ? "证据不足已结案，已转入治理台账。"
          : "已转业务处理，等待处理组反馈。",
    );
  };

  const pushForReview = (payload?: CollaborationDispatchPayload) => {
    if (!selectedDiff) return;
    const owner = selectedDiff.ownerSystem ?? "";
    const fallbackGroup = owner.includes("DMS") ? processingGroups[1] : owner.includes("接口") ? processingGroups[2] : processingGroups[0];
    const group = payload?.groupId ? (processingGroups.find((item) => item.id === payload.groupId) ?? fallbackGroup) : fallbackGroup;
    const member = payload?.handlerId ? group.members.find((item) => item.userId === payload.handlerId) : undefined;
    const assignee = member?.userName ?? group.name;
    const pushedAt = new Date().toLocaleString("zh-CN");
    const note = payload?.note?.trim();
    const pushLog = {
      id: `forward-${selectedDiff.id}-${Date.now()}`,
      diffId: selectedDiff.id,
      action: "FORWARDED",
      actor: "张会计",
      actorRole: "财务",
      timestamp: pushedAt,
      content: note
        ? `转发至${group.name}${member ? `（${member.userName}）` : ""}，协同意见：${note}`
        : `转发至${group.name}${member ? `（${member.userName}）` : ""}，请尽快核对并回传处理意见`,
    };
    setPushRecords((prev) => ({ ...prev, [selectedDiff.id]: { assignee, pushedAt: new Date().toLocaleString("zh-CN") } }));
    setDifferences((prev) => prev.map((item) => (
      item.id === selectedDiff.id
        ? {
            ...item,
            status: "FORWARDED_TO_BUSINESS",
            processingGroupId: group.id,
            processingGroupName: group.name,
            handlerId: member?.userId,
            handlerName: member?.userName,
            assignedAt: new Date().toISOString(),
            processingLogs: [...(item.processingLogs ?? []), pushLog],
          }
        : item
    )));
    setSelectedDiff((prev) => (
      prev
        ? {
            ...prev,
            status: "FORWARDED_TO_BUSINESS",
            processingGroupId: group.id,
            processingGroupName: group.name,
            handlerId: member?.userId,
            handlerName: member?.userName,
            assignedAt: new Date().toISOString(),
            processingLogs: [...(prev.processingLogs ?? []), pushLog],
          }
        : prev
    ));
    setPushModal({ diff: selectedDiff, assignee });
    const modeLabel = payload?.mode === "transfer" ? "已转办" : payload?.mode === "person" ? "已指定个人转派" : "已转处理组";
    showToast(note ? `${modeLabel}至 ${assignee}，并记录协同意见` : `${modeLabel}至 ${assignee}`);
    if (note) {
      console.info(`[协同评论] ${selectedDiff.billNo}: ${note}`);
    }
  };

  const submitBusinessFeedback = (opinion?: string) => {
    if (!selectedDiff) return;
    const trimmedOpinion = opinion?.trim();
    const roleLabel = roleMode === "sap" ? "SAP处理组" : roleMode === "dms" ? "DMS处理组" : "业务处理组";
    const actorName = selectedDiff.handlerName ?? `${roleLabel}负责人`;
    const now = new Date();
    const nowDisplay = now.toLocaleString("zh-CN");
    const logEntry = {
      id: `bizfb-${selectedDiff.id}-${now.getTime()}`,
      diffId: selectedDiff.id,
      action: "BUSINESS_OPINION",
      actor: actorName,
      actorRole: roleLabel,
      timestamp: nowDisplay,
      content: trimmedOpinion && trimmedOpinion.length > 0 ? trimmedOpinion : "业务处理组已提交处理意见并回传财务复核。",
    };
    setPushRecords((prev) => {
      const next = { ...prev };
      delete next[selectedDiff.id];
      return next;
    });
    setDifferences((prev) => prev.map((item) => (
      item.id === selectedDiff.id
        ? {
            ...item,
            status: "BUSINESS_FEEDBACK",
            processingLogs: [...(item.processingLogs ?? []), logEntry],
          }
        : item
    )));
    setSelectedDiff((prev) => (
      prev
        ? {
            ...prev,
            status: "BUSINESS_FEEDBACK",
            processingLogs: [...(prev.processingLogs ?? []), logEntry],
          }
        : prev
    ));
    setDetailOpen(false);
    showToast("处理意见已回传财务，等待财务复核。");
  };

  const handleStatusTransition = (newStatus: string) => {
    if (!selectedDiff) return;
    setDifferences((prev) => prev.map((item) => (item.id === selectedDiff.id ? { ...item, status: newStatus } : item)));
    setSelectedDiff((prev) => (prev ? { ...prev, status: newStatus } : prev));
    showToast(`状态已变更：${statusLabels[newStatus] ?? newStatus}`);
  };

  const remindCurrent = (diff: ReconciliationDifference) => {
    const pushed = pushRecords[diff.id];
    const nowText = new Date().toLocaleString("zh-CN");
    const reminderLog = {
      id: `remind-${diff.id}-${Date.now()}`,
      diffId: diff.id,
      action: "REMINDER",
      actor: "张会计",
      actorRole: "财务",
      timestamp: nowText,
      content: `财务催办${pushed?.assignee ?? "责任方"}，请尽快补充处理意见并回传`,
    };
    setDifferences((prev) => prev.map((item) => (
      item.id === diff.id
        ? { ...item, processingLogs: [...(item.processingLogs ?? []), reminderLog] }
        : item
    )));
    setSelectedDiff((prev) => (
      prev && prev.id === diff.id
        ? { ...prev, processingLogs: [...(prev.processingLogs ?? []), reminderLog] }
        : prev
    ));
    showToast(`已催办 ${pushed?.assignee ?? "责任方"}`);
  };

  const getPrimaryAction = (diff: ReconciliationDifference): { label: string; run: () => void } => {
    if (
      pushRecords[diff.id] &&
      !isClosed(diff) &&
      (diff.status === "FORWARDED_TO_BUSINESS" || diff.status === "BUSINESS_PROCESSING" || diff.status === "EVIDENCE_GATHERING")
    ) {
      return { label: "催办确认", run: () => { openDetail(diff); remindCurrent(diff); } };
    }
    switch (diff.status) {
      case "PENDING":
      case "PENDING_ATTRIBUTION":
        return { label: "启动归因", run: () => { setDetailOpen(true); void analyze(diff); } };
      case "ATTRIBUTING":
        return { label: "归因中...", run: () => openDetail(diff) };
      case "NEEDS_REVIEW":
      case "FINANCE_CONFIRMED":
        return { label: "查看报告", run: () => openDetail(diff) };
      case "INSUFFICIENT_EVIDENCE_CLOSED":
        return { label: "查看结案", run: () => openDetail(diff) };
      case "FORWARDED_TO_BUSINESS":
        return isBusinessProcessor
          ? { label: "认领处理", run: () => { openDetail(diff); handleStatusTransition("BUSINESS_PROCESSING"); } }
          : { label: "催办", run: () => openDetail(diff) };
      case "BUSINESS_PROCESSING":
        return isBusinessProcessor
          ? { label: "提交反馈", run: () => { openDetail(diff); submitBusinessFeedback(); } }
          : { label: "查看进度", run: () => openDetail(diff) };
      case "BUSINESS_FEEDBACK":
      case "FINANCE_REVIEWING":
        return { label: "财务复核", run: () => openDetail(diff) };
      default:
        return { label: "查看详情", run: () => openDetail(diff) };
    }
  };

  const filteredTodos = useMemo(() => {
    const isFinanceView = !isBusinessProcessor;
    let list = isFinanceView ? scopedDifferences : scopedDifferences.filter((d) => !isClosed(d));
    if (todoFilter !== "all") {
      list = list.filter((d) => {
        if (todoFilter === "NORMAL") return isFinanceNormalRecord(d);
        if (todoFilter === "PROCESSING") {
          return ["NEEDS_REVIEW", "FINANCE_CONFIRMED", "FINANCE_REVIEWING", "FORWARDED_TO_BUSINESS", "BUSINESS_PROCESSING", "BUSINESS_FEEDBACK"].includes(d.status);
        }
        if (todoFilter === "EVIDENCE_GATHERING") {
          return d.status === "EVIDENCE_GATHERING" || d.status === "INSUFFICIENT_EVIDENCE";
        }
        return d.status === todoFilter;
      });
    }
    if (reconTypeFilter !== "all") list = list.filter((d) => d.reconciliationType === reconTypeFilter);
    if (slaFilter !== "all") list = list.filter((d) => getSLATier(d) === slaFilter);
    return [...list].sort(sortBySLAUrgency);
  }, [isBusinessProcessor, scopedDifferences, todoFilter, reconTypeFilter, slaFilter]);

  const completedCases = useMemo(() => scopedDifferences.filter(isClosed), [scopedDifferences]);
  const listSource = useMemo(() => {
    if (workbenchTab === "cases") return completedCases;
    if (workbenchTab === "list" || workbenchTab === "todo" || workbenchTab === "overview") return filteredTodos;
    return filteredTodos;
  }, [completedCases, filteredTodos, workbenchTab]);

  const totalPages = Math.max(1, Math.ceil(listSource.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pagedListSource = listSource.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!initialBillNo || scopedDifferences.length === 0) return;
    const diff = scopedDifferences.find((item) => item.billNo === initialBillNo);
    if (diff) openDetail(diff);
  }, [initialBillNo, openDetail, scopedDifferences]);

  const todoFilterButtons: Array<[TodoFilter, string, number]> = !isBusinessProcessor
    ? [
      ["all", "全部", scopedDifferences.length],
      ["NORMAL", "正常", normalCount],
      ["PENDING_ATTRIBUTION", "待归因", metrics.pending],
      ["ATTRIBUTING", "归因中", metrics.attributing + metrics.evidenceGathering],
      ["PROCESSING", "处理中", processingCount],
    ]
    : [
      ["all", "全部", todoCount],
      ["PENDING_ATTRIBUTION", "待归因", metrics.pending],
      ["ATTRIBUTING", "归因中", metrics.attributing],
      ["EVIDENCE_GATHERING", "补证中", metrics.evidenceGathering],
      ["NEEDS_REVIEW", "需复核", metrics.review],
      ["INSUFFICIENT_EVIDENCE_CLOSED", "证据不足结案", metrics.insufficient],
      ["FORWARDED_TO_BUSINESS", "转业务", metrics.forwarded],
      ["BUSINESS_PROCESSING", "处理中", metrics.businessProcessing],
      ["BUSINESS_FEEDBACK", "已反馈", metrics.businessFeedback],
    ];

  return (
    <div className="h-full min-h-0 overflow-auto p-[clamp(16px,2vw,24px)]">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -10, x: "-50%" }}
            className="fixed left-1/2 top-6 z-[70] rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700 shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {pushModal && <DingTalkPushModal diff={pushModal.diff} assignee={pushModal.assignee} onClose={() => setPushModal(null)} />}
      {batchModalOpen && <BatchAnalyzeModal progress={batchProgress} running={batchRunning} onClose={() => setBatchModalOpen(false)} />}

      <div className="flex w-full min-w-0 flex-col gap-5">
        {workbenchTab !== "cases" && (
          <section className="ui-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-xl font-bold text-slate-900">{copy.title}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{copy.subtitle}</p>
            </div>
            <div className="px-5 py-3">
              <WorkbenchStatusPanel
                todoCount={todoCount}
                metrics={metrics}
                batchLabel={batchLabel}
                batchNumerator={batchStats.numerator}
                batchTotal={batchStats.total}
                batchPercent={batchStats.percent}
                batchCompleted={batchStats.completed}
                batchInProgress={batchStats.inProgress}
                closingDaysLeft={null}
                slaOverdue={metrics.slaOverdue}
                slaWarning={metrics.slaWarning}
                onOpenTodo={() => setWorkbenchTab("todo")}
                onFilterTodo={(filter) => {
                  setWorkbenchTab("todo");
                  setTodoFilter(filter);
                }}
              />
            </div>
          </section>
        )}

        <section className="ui-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">{workbenchTab === "cases" ? "已闭环案例" : copy.listTitle}</h3>
                <p className="mt-1 text-xs text-slate-500">{workbenchTab === "cases" ? "查看历史差异原因、处理路径和沉淀结论。" : copy.listHelp}</p>
              </div>
              {workbenchTab !== "cases" && pendingForBatch.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckedIds(new Set(pendingForBatch.map((d) => d.id)))}
                    className="ui-btn-secondary px-3 py-1.5 text-xs font-bold text-slate-600"
                  >
                    全选待归因 ({pendingForBatch.length})
                  </button>
                  {checkedIds.size > 0 && (
                    <button type="button" onClick={() => setCheckedIds(new Set())} className="ui-btn-secondary px-3 py-1.5 text-xs font-bold text-slate-500">
                      清空
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={checkedIds.size > 0 ? batchAnalyzeChecked : () => void runBatchAnalyze(pendingForBatch)}
                    disabled={batchRunning}
                    className="ui-btn-primary px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    {checkedIds.size > 0 ? `批量归因 (${checkedIds.size})` : `归因全部 (${pendingForBatch.length})`}
                  </button>
                </div>
              )}
            </div>

            {workbenchTab !== "cases" && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {todoFilterButtons.map(([key, label, count]) => (count > 0 || key === "all") && (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTodoFilter(key)}
                      className={cn("rounded-full px-3 py-1 text-xs font-bold transition-colors", todoFilter === key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
                    >
                      {label} {count}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400"><Filter className="mr-0.5 inline h-3 w-3" />对账类型:</span>
                  {(["all", "REVENUE", "AR", "INVENTORY", "SERVICE"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setReconTypeFilter(key)}
                      className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", reconTypeFilter === key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
                    >
                      {key === "all" ? "全部" : reconciliationTypeLabels[key]}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400"><Timer className="mr-0.5 inline h-3 w-3" />SLA:</span>
                  {(["all", "normal", "warning", "overdue"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSlaFilter(key)}
                      className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", slaFilter === key ? (key === "overdue" ? "bg-rose-600 text-white" : key === "warning" ? "bg-amber-600 text-white" : "bg-blue-600 text-white") : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
                    >
                      {key === "all" ? "全部" : key === "normal" ? "正常" : key === "warning" ? "预警" : "超时"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="max-h-[clamp(420px,55vh,680px)] divide-y divide-slate-100 overflow-y-auto scrollbar-thin scrollbar-track-slate-100 scrollbar-thumb-slate-300">
            {listSource.length === 0 ? (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-400">当前筛选下暂无差异</div>
            ) : (
              pagedListSource.map((diff) => {
                const primary = getPrimaryAction(diff);
                return (
                  <div key={diff.id}>
                    <DiffListItem
                      diff={diff}
                      selected={detailOpen && selectedDiff?.id === diff.id}
                      pushRecord={pushRecords[diff.id]}
                      selectable={workbenchTab !== "cases" && (diff.status === "PENDING_ATTRIBUTION" || diff.status === "PENDING")}
                      checked={checkedIds.has(diff.id)}
                      onToggleCheck={() => toggleCheck(diff.id)}
                      onSelect={() => openDetail(diff)}
                      primaryLabel={primary.label}
                      onPrimaryAction={primary.run}
                    />
                  </div>
                );
              })
            )}
          </div>

          {listSource.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
              <div className="text-xs font-medium text-slate-500">
                共 <span className="font-bold text-slate-700">{listSource.length}</span> 条，每页 {pageSize} 条，当前 {pageStart + 1}-{Math.min(pageStart + pageSize, listSource.length)} 条
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage <= 1}
                  className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNo) => (
                    <button
                      key={pageNo}
                      type="button"
                      onClick={() => setPage(pageNo)}
                      className={cn("h-7 min-w-7 rounded px-2 text-xs font-bold transition", safePage === pageNo ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}
                    >
                      {pageNo}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {detailOpen && selectedDiff && (
          <DiffDetailDrawer
            open={detailOpen}
            diff={selectedDiff}
            pushRecord={pushRecords[selectedDiff.id]}
            isAnalyzing={isAnalyzing}
            progressStepIndex={progressStepIndex}
            analysisResult={analysisResult}
            onClose={() => setDetailOpen(false)}
            onAnalyze={() => void analyze(selectedDiff)}
            onConfirm={() => updateReviewStatus("CONFIRMED")}
            onReject={() => updateReviewStatus("INSUFFICIENT_EVIDENCE_CLOSED")}
            onPush={pushForReview}
            onRemind={() => remindCurrent(selectedDiff)}
            onBusinessSubmit={submitBusinessFeedback}
            onStatusTransition={handleStatusTransition}
            roleMode={roleMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

