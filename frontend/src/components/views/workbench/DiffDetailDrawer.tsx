import React, { useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  GitBranch,
  History,
  Layers,
  MessageSquare,
  RefreshCcw,
  Send,
  Server,
  Tag,
  Timer,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils.ts";
import type { AnalysisResult, AttributionResult, GovernanceTag, ReconciliationCategory, ReconciliationDifference, SLATier } from "@/src/types.ts";
import type { AppViewMode } from "../../RoleSwitcher.tsx";
import { AttributionProgressPanel } from "./AttributionProgressPanel.tsx";
import { CompactProcessBar } from "./CompactProcessBar.tsx";
import {
  attributionResultLabels,
  attributionResultStyles,
  closedLoopSteps,
  governanceLevelColors,
  governanceLevelLabels,
  governanceTagDefinitions,
  processingGroups,
  processingLogActionLabels,
  reconciliationTypeColors,
  reconciliationTypeLabels,
  similarCaseHints,
  statusLabels,
  statusStyles,
  typeLabels,
} from "./constants.ts";
import { getFlowStepIndex, getSLATier, getTimeRemaining, getValidNextStatuses, getWaitHours } from "./workbenchUtils.ts";

export interface PushRecord {
  assignee: string;
  pushedAt: string;
}

export interface CollaborationDispatchPayload {
  groupId?: string;
  handlerId?: string;
  note?: string;
  mode?: "group" | "person" | "transfer";
}

export type DetailViewMode = "pending" | "attributing" | "needs_review" | "insufficient" | "completed" | "awaiting_confirm" | "forwarded" | "business_processing" | "business_feedback" | "finance_reviewing" | "evidence_gathering" | "processed";

export function resolveDetailView(diff: ReconciliationDifference, pushRecord?: PushRecord): DetailViewMode {
  const s = diff.status;
  if (pushRecord && s !== "COMPLETED" && s !== "CONFIRMED" && s !== "PROCESSED") {
    if (s === "FORWARDED_TO_BUSINESS") return "forwarded";
    if (s === "BUSINESS_PROCESSING") return "business_processing";
    if (s === "BUSINESS_FEEDBACK") return "business_feedback";
    if (s === "FINANCE_REVIEWING") return "finance_reviewing";
    if (s === "EVIDENCE_GATHERING") return "evidence_gathering";
    return "awaiting_confirm";
  }
  if (s === "PENDING_ATTRIBUTION" || s === "PENDING") return "pending";
  if (s === "ATTRIBUTING") return "attributing";
  if (s === "NEEDS_REVIEW" || s === "FINANCE_CONFIRMED") return "needs_review";
  if (s === "FORWARDED_TO_BUSINESS") return "forwarded";
  if (s === "BUSINESS_PROCESSING") return "business_processing";
  if (s === "BUSINESS_FEEDBACK") return "business_feedback";
  if (s === "FINANCE_REVIEWING") return "finance_reviewing";
  if (s === "INSUFFICIENT_EVIDENCE") return "insufficient";
  if (s === "EVIDENCE_GATHERING") return "evidence_gathering";
  if (s === "PROCESSED") return "processed";
  if (s === "COMPLETED" || s === "CONFIRMED") return "completed";
  return "pending";
}

const viewMeta: Record<DetailViewMode, { title: string; subtitle: string; accent: string }> = {
  pending: { title: "待归因", subtitle: "帆软差异已接入，尚未启动自动排查与归因流程", accent: "border-slate-200 bg-slate-50 text-slate-700" },
  attributing: { title: "系统归因中", subtitle: "正在自动排查跨系统数据，生成证据链与归因结论", accent: "border-blue-200 bg-blue-50 text-blue-700" },
  needs_review: { title: "需复核", subtitle: "查看归因报告，确认结论或推送责任方", accent: "border-amber-200 bg-amber-50 text-amber-700" },
  insufficient: { title: "证据不足", subtitle: "需补充跨系统证据后重新归因", accent: "border-rose-200 bg-rose-50 text-rose-700" },
  completed: { title: "已确认", subtitle: "差异已闭环，案例已沉淀", accent: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  awaiting_confirm: { title: "待责任方确认", subtitle: "已推送通知，等待处理组确认", accent: "border-violet-200 bg-violet-50 text-violet-700" },
  forwarded: { title: "已转业务处理", subtitle: "已推送至对应处理组，等待认领或处理", accent: "border-violet-200 bg-violet-50 text-violet-700" },
  business_processing: { title: "业务处理中", subtitle: "处理组正在排查并补充处理意见", accent: "border-sky-200 bg-sky-50 text-sky-700" },
  business_feedback: { title: "业务已反馈", subtitle: "处理组已提交处理意见，等待财务复核", accent: "border-lime-200 bg-lime-50 text-lime-700" },
  finance_reviewing: { title: "财务复核", subtitle: "处理组已反馈，财务正在进行最终复核", accent: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700" },
  evidence_gathering: { title: "补充证据中", subtitle: "处理组正在补充跨系统证据材料", accent: "border-pink-200 bg-pink-50 text-pink-700" },
  processed: { title: "已处理", subtitle: "业务侧已完成整改，财务确认闭环", accent: "border-green-200 bg-green-50 text-green-700" },
};

interface DiffDetailDrawerProps {
  open: boolean;
  diff: ReconciliationDifference;
  pushRecord?: PushRecord;
  isAnalyzing: boolean;
  progressStepIndex: number;
  analysisResult: AnalysisResult | null;
  onClose: () => void;
  onAnalyze: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onPush: (payload?: CollaborationDispatchPayload) => void;
  onRemind?: () => void;
  onBusinessSubmit?: (opinion?: string) => void;
  onStatusTransition?: (newStatus: string) => void;
  roleMode?: AppViewMode;
}

// ====== 差异摘要 ======

function DiffSummary({ diff }: { diff: ReconciliationDifference }) {
  const reconLabel = diff.reconciliationType ? reconciliationTypeLabels[diff.reconciliationType] : null;
  const attrLabel = diff.attributionResult ? attributionResultLabels[diff.attributionResult] : null;

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
      <div>
        <div className="text-xs text-slate-400">单据号</div>
        <div className="mt-1 font-bold text-slate-900">{diff.billNo}</div>
      </div>
      <div>
        <div className="text-xs text-slate-400">差异类型 / 对账类型</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-bold text-slate-900">{typeLabels[diff.type] ?? diff.type}</span>
          {reconLabel && (
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-bold", reconciliationTypeColors[diff.reconciliationType!])}>
              {reconLabel}
            </span>
          )}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-400">SAP / DMS 金额</div>
        <div className="mt-1 font-mono text-xs font-bold text-slate-900">
          ¥{diff.sapAmount.toLocaleString()} / ¥{diff.dmsAmount?.toLocaleString() ?? "-"}
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-400">差异金额 / 归因结果</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono font-bold text-rose-700">¥{diff.diffAmount.toLocaleString()}</span>
          {attrLabel && (
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-bold", attributionResultStyles[diff.attributionResult!])}>
              {attrLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ====== 治理标签面板 ======

function GovernanceTagPanel({ tagIds, level }: { tagIds?: string[]; level?: string }) {
  if (!tagIds || tagIds.length === 0) return null;
  const tags = tagIds
    .map((id) => governanceTagDefinitions.find((t) => t.id === id))
    .filter((t): t is GovernanceTag => t != null);

  return (
    <div className="mt-4 ui-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
        <Tag className="h-4 w-4 text-indigo-500" />
        治理标签
        {level && governanceLevelLabels[level] && (
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px]", governanceLevelColors[level])}>
            {governanceLevelLabels[level]}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {tags.map((tag) => (
          <span
            key={tag.id}
            title={tag.description}
            className={cn("rounded-full border px-2 py-1 text-[11px] font-bold cursor-help", governanceLevelColors[tag.level])}
          >
            {tag.level} {tag.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ====== 对账元数据面板 (Section 6.1) ======

function ReconciliationRecordInfo({ diff }: { diff: ReconciliationDifference }) {
  const rows: Array<[string, string]> = [
    ["对账批次号", diff.batchNo ?? "—"],
    ["对账规则名称", diff.ruleName ?? "—"],
    ["对账类型", diff.reconciliationType ? reconciliationTypeLabels[diff.reconciliationType] : "—"],
    ["对账期间", diff.reconciliationPeriod ?? "—"],
    ["业务日期", diff.reconciliationDate ?? "—"],
    ["差异字段", (diff.diffFields ?? []).join("、") || "—"],
    ["同步来源", diff.syncSource ?? "帆软"],
    ["同步时间", diff.syncTime ?? diff.createdAtLabel ?? "—"],
  ];

  return (
    <div className="mt-4 ui-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
        <ClipboardCheck className="h-4 w-4 text-blue-600" />
        对账结果信息
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <span className="shrink-0 text-xs text-slate-400">{label}:</span>
            <span className="font-bold text-slate-700">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ====== SAP 数据详情面板 (Section 6.2) ======

function EmptySourcePanel({ message }: { message: string }) {
  return (
    <div className="px-4 py-6 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function SAPPostingDetailPanel({ data }: { data?: import("@/src/types.ts").SAPPostingDetail }) {
  return (
    <div className="mt-4 ui-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
        <Database className="h-4 w-4 text-amber-600" />
        SAP 过账详情
      </div>
      {data ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm">
          {[
            ["公司代码", data.companyCode],
            ["会计年度", `${data.fiscalYear} / ${data.fiscalPeriod}`],
            ["凭证号", `${data.documentNumber} / ${data.documentLine}`],
            ["科目编码", `${data.accountCode} ${data.accountName}`],
            data.customerCode ? ["客户", `${data.customerCode} ${data.customerName}`] : null,
            data.vendorCode ? ["供应商", `${data.vendorCode} ${data.vendorName}`] : null,
            ["本币金额", `¥${data.amountInLocalCurrency.toLocaleString()} ${data.currency}`],
            ["税额", `¥${data.taxAmount.toLocaleString()}`],
            ["利润中心", data.profitCenter],
            ["成本中心", data.costCenter],
            data.orderNumber ? ["订单号", data.orderNumber] : null,
            data.contractNumber ? ["合同号", data.contractNumber] : null,
            ["过账日期", data.postingDate],
            ["凭证日期", data.documentDate],
            ["摘要", data.summary],
            ["状态", `${data.postingStatus} / ${data.billingStatus} / ${data.cancelStatus}`],
            data.referenceDocNumber ? ["参考凭证", data.referenceDocNumber] : null,
          ].filter((r): r is [string, string] => r != null).map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="shrink-0 text-xs text-slate-400">{label}:</span>
              <span className="font-bold text-slate-700 truncate">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptySourcePanel message="暂无 SAP 原始明细，待接口同步或权限授权后展示。" />
      )}
    </div>
  );
}

// ====== DMS 数据详情面板 (Section 6.3) ======

function DMSRevenueDetailPanel({ data }: { data?: import("@/src/types.ts").DMSRevenueDetail }) {
  return (
    <div className="mt-4 ui-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
        <Database className="h-4 w-4 text-teal-600" />
        DMS 结算详情
      </div>
      {data ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm">
          {[
            ["DMS 订单号", data.orderNumber],
            ["经销商", `${data.dealerCode} ${data.dealerName}`],
            ["客户", `${data.customerCode} ${data.customerName}`],
            ["业务类型", data.businessType],
            ["订单状态", data.orderStatus],
            ["结算单号", data.settlementNumber],
            ["结算状态", data.settlementStatus],
            ["商品", `${data.productCode} ${data.productName}`],
            ["数量", `${data.quantity} ${data.unit}`],
            ["未税金额", `¥${data.amountExcludingTax.toLocaleString()}`],
            ["含税金额", `¥${data.amountIncludingTax.toLocaleString()} (${data.taxRate})`],
            ["税额", `¥${data.taxAmount.toLocaleString()}`],
            ["收入确认", data.revenueRecognitionStatus],
            ["回款状态", data.paymentStatus],
            ["创建时间", data.createdAt],
            ["更新时间", data.updatedAt],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="shrink-0 text-xs text-slate-400">{label}:</span>
              <span className="font-bold text-slate-700 truncate">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptySourcePanel message="暂无 DMS 原始明细，待接口同步或权限授权后展示。" />
      )}
    </div>
  );
}

// ====== 集成日志面板 (Section 6.5) ======

function IntegrationLogPanel({ logs }: { logs?: import("@/src/types.ts").IntegrationLogSummary[] }) {
  return (
    <div className="mt-4 ui-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
        <Server className="h-4 w-4 text-purple-600" />
        集成链路日志
      </div>
      {logs && logs.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              <th className="px-3 py-2 font-bold">来源</th>
              <th className="px-3 py-2 font-bold">目标</th>
              <th className="px-3 py-2 font-bold">方向</th>
              <th className="px-3 py-2 font-bold">数据类别</th>
              <th className="px-3 py-2 font-bold">批次号</th>
              <th className="px-3 py-2 font-bold">调用时间</th>
              <th className="px-3 py-2 font-bold">状态</th>
              <th className="px-3 py-2 font-bold">重试</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-bold text-slate-700">{log.sourceSystem}</td>
                <td className="px-3 py-2 text-slate-600">{log.targetSystem}</td>
                <td className="px-3 py-2 text-slate-500">{log.direction?.replace(/\s\?\s/g, " -> ")}</td>
                <td className="px-3 py-2 text-slate-500">{log.dataCategory}</td>
                <td className="px-3 py-2 font-mono text-slate-500">{log.syncBatchNo}</td>
                <td className="px-3 py-2 text-slate-500">{log.callTime}</td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", log.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                    {log.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">{log.retryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
        <EmptySourcePanel message="暂无集成链路日志，待接口日志回传后展示。" />
      )}
    </div>
  );
}

// ====== SLA 计时器 ======

function SLATimer({ diff }: { diff: ReconciliationDifference }) {
  const tier = getSLATier(diff);
  const timeInfo = getTimeRemaining(diff);
  const config: Record<SLATier, { icon: React.ElementType; color: string; bg: string; border: string }> = {
    normal: { icon: Timer, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    warning: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    overdue: { icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  };
  const { icon: Icon, color, bg, border } = config[tier];

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border px-4 py-3", bg, border)}>
      <Icon className={cn("h-5 w-5", color)} />
      <div>
        <div className={cn("text-sm font-bold", color)}>
          SLA: {timeInfo.label}
          {!timeInfo.isOverdue && ` ${timeInfo.hours}h`}
          {timeInfo.isOverdue && ` ${timeInfo.hours}h`}
        </div>
        {diff.slaDeadline && (
          <div className="text-xs text-slate-500">截止: {new Date(diff.slaDeadline).toLocaleString("zh-CN")}</div>
        )}
        {diff.escalationLevel && diff.escalationLevel > 0 && (
          <div className="mt-1 text-[11px] font-bold text-rose-600">
            已升级 {diff.escalationLevel} 级
            {diff.lastRemindedAt && ` · 最近催办: ${diff.lastRemindedAt}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ====== 处理组选择器 ======

function ProcessingGroupPicker({
  currentGroupId,
  currentHandler,
  onAssign,
}: {
  currentGroupId?: string;
  currentHandler?: string;
  onAssign: (groupId: string, handlerId?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(currentGroupId ?? "");
  const [selectedHandler, setSelectedHandler] = useState(currentHandler ?? "");

  const group = processingGroups.find((g) => g.id === selectedGroup);

  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-violet-900">
        <Users className="h-4 w-4" />
        选择处理组
      </div>
      <div className="mt-3 space-y-3">
        <div className="grid gap-2">
          {processingGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => { setSelectedGroup(g.id); setExpanded(true); }}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition",
                selectedGroup === g.id
                  ? "border-violet-300 bg-violet-100 font-bold text-violet-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-violet-200",
              )}
            >
              <div>
                <div className="font-bold">{g.name}</div>
                <div className="text-xs text-slate-500">{g.description}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {g.members.length} 人
                <ChevronDown className={cn("h-4 w-4 transition", expanded && selectedGroup === g.id && "rotate-180")} />
              </div>
            </button>
          ))}
        </div>

        {expanded && group && (
          <div className="ui-card p-3">
            <div className="text-xs font-bold text-slate-500 mb-2">
              可选处理人（{group.strategy === "MANUAL_CLAIM" ? "手动认领" : "自动分配"}）
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedHandler("")}
                className={cn("w-full rounded px-3 py-1.5 text-left text-xs", !selectedHandler ? "bg-violet-50 font-bold text-violet-700" : "text-slate-600 hover:bg-slate-50")}
              >
                不指定（组内自动分配）
              </button>
              {group.members.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => setSelectedHandler(m.userId)}
                  className={cn(
                    "w-full flex items-center justify-between rounded px-3 py-1.5 text-left text-xs",
                    selectedHandler === m.userId ? "bg-violet-50 font-bold text-violet-700" : "text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <span>{m.userName}</span>
                  <span className="text-slate-400">当前负载 {m.currentLoad}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={!selectedGroup}
          onClick={() => onAssign(selectedGroup, selectedHandler || undefined)}
          className="w-full rounded-lg bg-violet-600 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          确认分配并推送通知
        </button>
      </div>
    </div>
  );
}

// ====== 状态流操作按钮 ======

function StatusFlowActions({
  diff,
  viewMode,
  roleMode,
  onAnalyze,
  onConfirm,
  onReject,
  onPush,
  onRemind,
  onBusinessSubmit,
  onTransition,
  isAnalyzing,
  hasReport,
}: {
  diff: ReconciliationDifference;
  viewMode: DetailViewMode;
  roleMode: AppViewMode;
  onAnalyze: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onPush: (payload?: CollaborationDispatchPayload) => void;
  onRemind?: () => void;
  onBusinessSubmit?: (opinion?: string) => void;
  onTransition?: (newStatus: string) => void;
  isAnalyzing: boolean;
  hasReport: boolean;
}) {
  const isBusiness = roleMode === "sap" || roleMode === "dms";
  const owner = diff.ownerSystem ?? "";
  const defaultGroup = diff.processingGroupId
    ?? (owner.includes("DMS") ? processingGroups[1]?.id : owner.includes("接口") ? processingGroups[2]?.id : processingGroups[0]?.id);
  const [selectedGroupId, setSelectedGroupId] = useState(defaultGroup ?? "");
  const [selectedHandlerId, setSelectedHandlerId] = useState(diff.handlerId ?? "");
  const [collabNote, setCollabNote] = useState("");
  const [businessOpinion, setBusinessOpinion] = useState("");
  const [businessTouched, setBusinessTouched] = useState(false);
  const selectedGroup = processingGroups.find((group) => group.id === selectedGroupId);
  const selectedHandler = selectedGroup?.members.find((member) => member.userId === selectedHandlerId);
  const canFinanceDecide =
    !isBusiness &&
    (
      ((viewMode === "needs_review" || viewMode === "finance_reviewing") && hasReport) ||
      viewMode === "business_feedback"
    );
  const canDispatch = !isBusiness && (canFinanceDecide || viewMode === "insufficient");
  const canRemindOrTransfer = !isBusiness && (viewMode === "forwarded" || viewMode === "awaiting_confirm" || viewMode === "business_processing" || viewMode === "evidence_gathering");
  const businessOpinionValid = businessOpinion.trim().length >= 8;
  const dispatchPayload = (mode: CollaborationDispatchPayload["mode"]) => ({
    groupId: selectedGroupId,
    handlerId: selectedHandlerId || undefined,
    note: collabNote.trim() || undefined,
    mode,
  });

  return (
    <div className="space-y-4">
      {(viewMode === "pending" || viewMode === "attributing" || viewMode === "needs_review" || viewMode === "insufficient") && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-900">
            <Brain className="h-4 w-4" />
            系统归因
          </div>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing || viewMode === "attributing"}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isAnalyzing || viewMode === "attributing" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {isAnalyzing || viewMode === "attributing" ? "归因中..." : viewMode === "pending" ? "启动归因" : hasReport ? "重新归因" : "加载归因报告"}
          </button>
        </div>
      )}

      {(canFinanceDecide || canDispatch || canRemindOrTransfer) && (
        <div className="ui-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Users className="h-4 w-4 text-blue-600" />
                转发与协同
              </div>
              <p className="mt-1 text-xs text-slate-500">处理组为主、个人为辅；财务可转处理组、指定个人、转办并登记协同意见。</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
              {selectedHandler ? `指定：${selectedHandler.userName}` : selectedGroup ? `处理组：${selectedGroup.name}` : "待选择"}
            </span>
          </div>

          {canFinanceDecide && (
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="mb-2 text-xs font-bold text-slate-500">1. 财务判断</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onAnalyze}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  重新归因
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="inline-flex items-center gap-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  <X className="h-4 w-4" />
                  财务判断有问题
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  确认无误并闭环
                </button>
              </div>
            </div>
          )}

          {(canDispatch || canRemindOrTransfer) && (
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="mb-2 text-xs font-bold text-slate-500">{canFinanceDecide ? "2" : "1"}. 分派对象</div>
              <div className="grid gap-2 lg:grid-cols-3">
                {processingGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      setSelectedHandlerId("");
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition",
                      selectedGroupId === group.id ? "border-blue-200 bg-blue-50 ring-1 ring-blue-100" : "border-slate-200 bg-white hover:border-blue-100 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">{group.name}</span>
                      <span className="text-[10px] font-bold text-slate-400">{group.members.length} 人</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{group.description}</p>
                  </button>
                ))}
              </div>

              {selectedGroup && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">指定个人（可选）</span>
                    <span className="text-[10px] text-slate-400">不指定时由组内认领或按策略分配</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedHandlerId("")}
                      className={cn("rounded-full px-3 py-1.5 text-xs font-bold", !selectedHandlerId ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100")}
                    >
                      组内认领
                    </button>
                    {selectedGroup.members.map((member) => (
                      <button
                        key={member.userId}
                        type="button"
                        onClick={() => setSelectedHandlerId(member.userId)}
                        className={cn("rounded-full px-3 py-1.5 text-xs font-bold", selectedHandlerId === member.userId ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100")}
                      >
                        {member.userName} · 负载 {member.currentLoad}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(canDispatch || canRemindOrTransfer) && (
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="mb-2 text-xs font-bold text-slate-500">{canFinanceDecide ? "3" : "2"}. 评论协同</div>
              <textarea
                value={collabNote}
                onChange={(event) => setCollabNote(event.target.value)}
                rows={3}
                placeholder="补充转派原因、希望责任方核对的字段、已确认的证据或处理建议。"
                className="w-full resize-none ui-card px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="text-xs text-slate-500">
              下一状态：
              {canDispatch && <span className="font-bold text-violet-700">转业务处理 → 业务处理中 → 业务已反馈 → 财务复核</span>}
              {canRemindOrTransfer && <span className="font-bold text-violet-700">保持当前处理链路，记录催办/转办/评论</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canRemindOrTransfer && (
                <button
                  type="button"
                  onClick={onRemind}
                  className="inline-flex items-center gap-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100"
                >
                  <Send className="h-4 w-4" />
                  催办
                </button>
              )}
              {canRemindOrTransfer && (
                <button
                  type="button"
                  onClick={() => onPush(dispatchPayload("transfer"))}
                  className="inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Users className="h-4 w-4" />
                  转办
                </button>
              )}
              {canDispatch && (
                <>
                  <button
                    type="button"
                    onClick={() => onPush(dispatchPayload("group"))}
                    disabled={!selectedGroupId}
                    className="inline-flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Users className="h-4 w-4" />
                    转处理组
                  </button>
                  <button
                    type="button"
                    onClick={() => onPush(dispatchPayload("person"))}
                    disabled={!selectedGroupId || !selectedHandlerId}
                    className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    指定个人并转派
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isBusiness && (viewMode === "forwarded" || viewMode === "awaiting_confirm" || viewMode === "business_processing" || viewMode === "evidence_gathering") && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-900">
            <UserCheck className="h-4 w-4" />
            业务处理
          </div>
          <div className="mb-3 rounded-lg border border-sky-100 bg-white/70 px-3 py-2 text-xs text-slate-600">
            按财务协同要求补充处理意见后回传，由财务统一复核闭环。
          </div>
          <div className="mb-3">
            <div className="mb-1 text-xs font-bold text-slate-500">处理意见（必填）</div>
            <textarea
              value={businessOpinion}
              onChange={(event) => setBusinessOpinion(event.target.value)}
              onBlur={() => setBusinessTouched(true)}
              rows={3}
              placeholder="请填写已核对字段、发现原因、修复动作与回传说明（至少 8 个字）。"
              className={cn(
                "w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition",
                businessTouched && !businessOpinionValid
                  ? "border-rose-300 ring-2 ring-rose-100"
                  : "border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
              )}
            />
            {businessTouched && !businessOpinionValid && (
              <p className="mt-1 text-xs font-bold text-rose-600">请至少填写 8 个字的处理意见后再提交回传。</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setBusinessTouched(true);
                if (!businessOpinionValid) return;
                onBusinessSubmit?.(businessOpinion.trim());
              }}
              disabled={!businessOpinionValid}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              提交处理意见并回传财务
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== 处理日志时间线 ======

function ProcessingLogTimeline({ logs, diff, pushRecord }: { logs?: import("@/src/types.ts").ProcessingLogEntry[]; diff: ReconciliationDifference; pushRecord?: PushRecord }) {
  const entries = logs ?? [];
  if (entries.length === 0) {
    const waitHours = getWaitHours(diff);
    return (
      <div className="mt-4 ui-card">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
          <History className="h-4 w-4 text-blue-600" />
          处理日志
        </div>
        <div className="px-4 py-6 text-center text-sm text-slate-400">暂无处理记录</div>
      </div>
    );
  }

  const actionColors: Record<string, string> = {
    SYSTEM_ATTRIBUTION: "bg-blue-100 text-blue-700",
    STATUS_CHANGE: "bg-slate-100 text-slate-700",
    FORWARDED: "bg-violet-100 text-violet-700",
    FINANCE_OPINION: "bg-teal-100 text-teal-700",
    BUSINESS_OPINION: "bg-sky-100 text-sky-700",
    EVIDENCE_SUPPLEMENT: "bg-pink-100 text-pink-700",
    REMINDER: "bg-orange-100 text-orange-700",
    TIMEOUT_ALERT: "bg-rose-100 text-rose-700",
    TRANSFER: "bg-purple-100 text-purple-700",
    CONFIRMATION: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="mt-4 ui-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
        <History className="h-4 w-4 text-blue-600" />
        处理日志（{entries.length}）
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
        {entries.map((entry, i) => (
          <div key={entry.id || i} className="flex items-start gap-3 px-4 py-3">
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold", actionColors[entry.action] ?? "bg-slate-100 text-slate-600")}>
              {processingLogActionLabels[entry.action] ?? entry.action}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-900">{entry.actor}</span>
                <span className="text-slate-400">({entry.actorRole})</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">{entry.content}</p>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">{entry.timestamp}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ====== 生命周期面板 ======

function ResponsibilityTimeline({ diff, pushRecord }: { diff: ReconciliationDifference; pushRecord?: PushRecord }) {
  const latestLog = diff.processingLogs?.[diff.processingLogs.length - 1];
  const currentOwner =
    diff.handlerName ??
    diff.processingGroupName ??
    (diff.status === "FORWARDED_TO_BUSINESS" || diff.status === "BUSINESS_PROCESSING" ? "业务处理组" : "财务复核");
  const currentTime = diff.assignedAt ?? pushRecord?.pushedAt ?? latestLog?.timestamp ?? diff.createdAtLabel ?? "-";

  const stageLabelMap: Record<string, string> = {
    PENDING: "差异接入",
    PENDING_ATTRIBUTION: "差异接入",
    ATTRIBUTING: "自动归因",
    NEEDS_REVIEW: "人工复核",
    FINANCE_CONFIRMED: "人工复核",
    FORWARDED_TO_BUSINESS: "责任方处理",
    BUSINESS_PROCESSING: "责任方处理",
    BUSINESS_FEEDBACK: "回传确认",
    EVIDENCE_GATHERING: "回传确认",
    FINANCE_REVIEWING: "财务复核",
    COMPLETED: "闭环沉淀",
    CONFIRMED: "闭环沉淀",
    PROCESSED: "闭环沉淀",
  };
  const currentStage = stageLabelMap[diff.status] ?? "处理中";

  const timeline = [
    { key: "stage", label: "当前阶段", value: currentStage },
    { key: "owner", label: "当前责任方", value: currentOwner },
    { key: "time", label: "进入时间", value: currentTime },
    { key: "action", label: "最近动作", value: latestLog ? `${latestLog.actor}: ${latestLog.content}` : "暂无处理动作" },
  ];

  return (
    <div className="mt-4 ui-card p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <GitBranch className="h-4 w-4 text-blue-600" />
        责任流转时间线
      </div>
      <div className="mt-3 space-y-2">
        {timeline.map((item) => (
          <div key={item.key} className="grid grid-cols-[112px_1fr] gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-400">{item.label}</div>
            <div className="text-sm font-semibold text-slate-700">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisReportBody({
  diff,
  analysisResult,
  pushRecord,
  roleMode,
  onConfirm,
  onReject,
  onPush,
  onRemind,
  onBusinessSubmit,
  onTransition,
  viewMode,
  isAnalyzing,
}: {
  diff: ReconciliationDifference;
  analysisResult: AnalysisResult;
  pushRecord?: PushRecord;
  roleMode: AppViewMode;
  onConfirm: () => void;
  onReject: () => void;
  onPush: (payload?: CollaborationDispatchPayload) => void;
  onRemind?: () => void;
  onBusinessSubmit?: (opinion?: string) => void;
  onTransition?: (newStatus: string) => void;
  viewMode: DetailViewMode;
  isAnalyzing: boolean;
}) {
  const evidenceRows = analysisResult.evidenceChain ?? [];
  const readOnly = viewMode === "completed" || viewMode === "processed" || viewMode === "forwarded";

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50/40 p-5">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-600">归因结论</div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="text-lg font-bold leading-relaxed text-slate-900">{analysisResult.rootCause}</p>
            <p className="mt-2 text-xs font-bold text-amber-700">辅助归因，待人工确认 · 不自动修复数据</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-4 py-3 text-center">
            <div className="text-xs font-bold text-slate-500">置信度</div>
            <div className="text-3xl font-bold text-blue-700">{analysisResult.confidence}%</div>
          </div>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">
          <Zap className="h-4 w-4" />
          首个异常环节：{analysisResult.firstAbnormalNode}
        </div>
        {similarCaseHints[diff.type] && (
          <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {similarCaseHints[diff.type]}
          </div>
        )}
      </div>

      {evidenceRows.length > 0 && (
        <div className="rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-bold text-slate-500">
            <Database className="h-4 w-4 text-blue-600" />
            结构化证据链
          </div>
          <div className="divide-y divide-slate-100">
            {evidenceRows.map((item, i) => (
              <div key={`ev-${i}`} className="grid grid-cols-[140px_120px_1fr_1fr_90px] gap-2 px-4 py-3 text-sm">
                <div className="font-bold text-slate-900">{item.sourceSystem}</div>
                <div className="text-xs font-bold text-slate-500">{item.checkField}</div>
                <div className="min-w-0 truncate text-slate-600">{item.expected}</div>
                <div className="min-w-0 truncate text-slate-600">{item.actual}</div>
                <div>
                  <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", item.result === "一致" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                    {item.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysisResult.report && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-white">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-300">
            <MessageSquare className="h-4 w-4 text-blue-300" />
            说明报告（脱敏摘要）
          </div>
          <div className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
            {analysisResult.report || analysisResult.modelSummary}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-slate-700">
        <div className="grid gap-2 sm:grid-cols-4">
          <div><div className="text-slate-400">当前责任环节</div><div className="mt-1 font-bold text-slate-900">{roleMode === "sap" ? "SAP 处理组" : roleMode === "dms" ? "DMS 处理组" : "财务复核"}</div></div>
          <div><div className="text-slate-400">指派对象</div><div className="mt-1 font-bold text-slate-900">{diff.handlerName ?? pushRecord?.assignee ?? diff.processingGroupName ?? diff.ownerSystem ?? "待指派"}</div></div>
          <div><div className="text-slate-400">指派时间</div><div className="mt-1 font-bold text-slate-900">{diff.assignedAt ?? pushRecord?.pushedAt ?? "未指派"}</div></div>
          <div><div className="text-slate-400">处理 SLA</div><div className="mt-1 font-bold text-slate-900">{diff.slaDeadline ? `${Math.max(0, Math.round((new Date(diff.slaDeadline).getTime() - Date.now()) / (1000*60*60)))}h 剩余` : "48 小时"}</div></div>
        </div>
      </div>

      
    </div>
  );
}

// ====== 主组件 ======

export function DiffDetailDrawer({
  open,
  diff,
  pushRecord,
  isAnalyzing,
  progressStepIndex,
  analysisResult,
  onClose,
  onAnalyze,
  onConfirm,
  onReject,
  onPush,
  onRemind,
  onBusinessSubmit,
  onStatusTransition,
  roleMode = "finance",
}: DiffDetailDrawerProps) {
  if (!open) return null;

  const viewMode = resolveDetailView(diff, pushRecord);
  const meta = viewMeta[viewMode];
  const hasReport = analysisResult && !analysisResult.error;
  const readOnly = viewMode === "completed" || viewMode === "processed";
  const isBusiness = roleMode === "sap" || roleMode === "dms";
  const showAttributionFlow = true;

  return (
    <>
      <motion.button
        type="button"
        aria-label="关闭详情"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: "spring", damping: 26, stiffness: 280 }}
        className="fixed left-1/2 top-1/2 z-[61] flex h-[86vh] w-[min(1180px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">{meta.title}</h3>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", meta.accent)}>
                {statusLabels[diff.status] ?? diff.status}
              </span>
              {diff.attributionResult && (
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", attributionResultStyles[diff.attributionResult])}>
                  {attributionResultLabels[diff.attributionResult]}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">{meta.subtitle}</p>
            <p className="mt-1 font-mono text-xs text-slate-400">{diff.billNo}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Agent attribution flow, not the business handling lifecycle. */}
        {showAttributionFlow && (
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Agent 归因过程</div>
            <CompactProcessBar steps={closedLoopSteps} activeIndex={getFlowStepIndex(diff)} />
          </div>
        )}

        {/* Action toolbar */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          {(viewMode === "pending" || viewMode === "attributing") && (
            <button type="button" onClick={onAnalyze} disabled={isAnalyzing || viewMode === "attributing"}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {isAnalyzing || viewMode === "attributing" ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {isAnalyzing || viewMode === "attributing" ? "归因中..." : "启动归因"}
            </button>
          )}
          {(viewMode === "needs_review" || viewMode === "insufficient") && (
            <button type="button" onClick={onAnalyze} disabled={isAnalyzing}
              className="inline-flex items-center gap-2 ui-card px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCcw className="h-4 w-4" />
              {hasReport ? "重新归因" : "加载归因报告"}
            </button>
          )}
          {viewMode === "forwarded" && !isBusiness && (
            <button type="button" onClick={onRemind}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100">
              <Send className="h-4 w-4" />催办确认
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <DiffSummary diff={diff} />

          <GovernanceTagPanel tagIds={diff.governanceTags} level={diff.governanceLevel} />

          <ReconciliationRecordInfo diff={diff} />
          <SAPPostingDetailPanel data={diff.sapDetail} />
          <DMSRevenueDetailPanel data={diff.dmsDetail} />
          <IntegrationLogPanel logs={diff.integrationLogs} />

          <SLATimer diff={diff} />

          

          {!readOnly && (
            <StatusFlowActions
              diff={diff}
              viewMode={viewMode}
              roleMode={roleMode}
              onAnalyze={onAnalyze}
              onConfirm={onConfirm}
              onReject={onReject}
              onPush={onPush}
              onRemind={onRemind}
              onBusinessSubmit={onBusinessSubmit}
              onTransition={onStatusTransition}
              isAnalyzing={isAnalyzing}
              hasReport={Boolean(hasReport)}
            />
          )}

          {pushRecord && (viewMode === "awaiting_confirm" || viewMode === "forwarded" || viewMode === "business_processing" || viewMode === "evidence_gathering") && (
            <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                已推送 <span className="font-bold">{pushRecord.assignee}</span>
                {viewMode === "business_processing" || viewMode === "evidence_gathering" ? "，处理中" : "，等待确认中"}
                <div className="mt-0.5 text-xs text-violet-700">{pushRecord.pushedAt}</div>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <AttributionProgressPanel activeStepIndex={progressStepIndex} isComplete={false} />
          )}

          {!isAnalyzing && analysisResult?.error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">
              <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" />分析失败</div>
              <p className="mt-2 text-sm">{analysisResult.error}</p>
            </div>
          )}

          {!isAnalyzing && viewMode === "pending" && !analysisResult && (
            <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
              <GitBranch className="mx-auto h-12 w-12 text-blue-600" />
              <h4 className="mt-4 font-bold text-slate-900">等待启动归因</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">平台将按差异类型自动排查 DMS、SAP、主数据与接口日志，并生成证据链报告。</p>
            </div>
          )}

          {!isAnalyzing && viewMode === "attributing" && !analysisResult && (
            <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
              <Brain className="mx-auto h-12 w-12 text-blue-600 animate-pulse" />
              <h4 className="mt-4 font-bold text-slate-900">系统归因中...</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">正在按 Skill 步骤逐环节核对，预计 30 秒内完成。</p>
            </div>
          )}

          {!isAnalyzing && viewMode === "needs_review" && !hasReport && (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-8 text-center">
              <ClipboardCheck className="mx-auto h-12 w-12 text-amber-600" />
              <h4 className="mt-4 font-bold text-slate-900">归因已完成，待您复核</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">该差异已完成自动排查。点击按钮查看证据链与归因结论。</p>
              <button type="button" onClick={onAnalyze} className="mt-5 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700">加载归因报告</button>
            </div>
          )}

          {!isAnalyzing && viewMode === "insufficient" && !hasReport && (
            <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/50 p-8 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-rose-600" />
              <h4 className="mt-4 font-bold text-slate-900">证据不足，需补充后重查</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">上次复核认为现有证据无法支撑结论。请重新归因或联系处理组补充材料。</p>
            </div>
          )}

          {!isAnalyzing && (viewMode === "forwarded" || viewMode === "awaiting_confirm") && !hasReport && (
            <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">
              <Send className="mx-auto h-12 w-12 text-violet-600" />
              <h4 className="mt-4 font-bold text-slate-900">等待责任方确认</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
                {isBusiness ? "财务已转发该异常。请核对本系统数据、补充处理意见后回传财务复核。" : "归因结论已推送，处理组可通过链接查看证据。您可催办或查看历史报告。"}
              </p>
              {!hasReport && <button type="button" onClick={onAnalyze} className="mt-5 text-sm font-bold text-violet-700 hover:underline">查看归因报告</button>}
            </div>
          )}

          {!isAnalyzing && viewMode === "business_processing" && !hasReport && (
            <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/40 p-8 text-center">
              <Layers className="mx-auto h-12 w-12 text-sky-600" />
              <h4 className="mt-4 font-bold text-slate-900">业务处理中</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">处理组正在进行问题排查。完成后将提交处理意见并回传财务复核。</p>
            </div>
          )}

          {!isAnalyzing && viewMode === "business_feedback" && !hasReport && (
            <div className="rounded-xl border border-dashed border-lime-200 bg-lime-50/40 p-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-lime-600" />
              <h4 className="mt-4 font-bold text-slate-900">业务已反馈</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">处理组已提交处理意见。请财务复核并确认闭环。</p>
            </div>
          )}

          {!isAnalyzing && viewMode === "finance_reviewing" && !hasReport && (
            <div className="rounded-xl border border-dashed border-fuchsia-200 bg-fuchsia-50/40 p-8 text-center">
              <BookOpenCheck className="mx-auto h-12 w-12 text-fuchsia-600" />
              <h4 className="mt-4 font-bold text-slate-900">财务复核</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">处理组已反馈处理意见。财务正在进行最终复核确认。</p>
            </div>
          )}

          {!isAnalyzing && viewMode === "evidence_gathering" && !hasReport && (
            <div className="rounded-xl border border-dashed border-pink-200 bg-pink-50/40 p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-pink-600" />
              <h4 className="mt-4 font-bold text-slate-900">补充证据中</h4>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">处理组正在补充跨系统证据材料。补充完成后将回传财务复核。</p>
            </div>
          )}

          {!isAnalyzing && (viewMode === "completed" || viewMode === "processed") && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
              <BookOpenCheck className="mx-auto h-12 w-12 text-emerald-600" />
              <h4 className="mt-4 font-bold text-slate-900">
                {viewMode === "processed" ? "差异已处理并闭环" : "差异已确认并沉淀"}
              </h4>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
                {viewMode === "processed" ? "业务侧已完成整改，财务确认闭环。" : "该差异已闭环，同类问题可在案例库中快速匹配历史处理方式。"}
              </p>
              {diff.closeReason && <p className="mt-2 text-xs font-bold text-emerald-700">关闭原因：{diff.closeReason}</p>}
              {hasReport && (
                <AnalysisReportBody
                  diff={diff} analysisResult={analysisResult} pushRecord={pushRecord} roleMode={roleMode}
                  onConfirm={onConfirm} onReject={onReject} onPush={onPush}
                  onRemind={onRemind} onBusinessSubmit={onBusinessSubmit}
                  viewMode={viewMode} isAnalyzing={isAnalyzing}
                />
              )}
            </div>
          )}

          {!isAnalyzing && hasReport && viewMode !== "completed" && viewMode !== "processed" && (
            <AnalysisReportBody
              diff={diff} analysisResult={analysisResult} pushRecord={pushRecord} roleMode={roleMode}
              onConfirm={onConfirm} onReject={onReject} onPush={onPush}
              onRemind={onRemind} onBusinessSubmit={onBusinessSubmit}
              viewMode={viewMode} isAnalyzing={isAnalyzing}
            />
          )}

          <ProcessingLogTimeline logs={diff.processingLogs} diff={diff} pushRecord={pushRecord} />
        </div>
      </motion.section>
    </>
  );
}


