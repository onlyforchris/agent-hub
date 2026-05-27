import type { AttributionResult, GovernanceLevel, ReconciliationDifference, SLATier } from "@/src/types.ts";
import { slaDefaults, statusTransitions } from "./constants.ts";

// ====== 等待时长 ======

export function getWaitHours(diff: ReconciliationDifference): number | null {
  if (!diff.createdAt) return null;
  const ms = Date.now() - new Date(diff.createdAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60)));
}

// ====== 排序 ======

export function sortWorkbenchDiffs(a: ReconciliationDifference, b: ReconciliationDifference): number {
  const amountDiff = b.diffAmount - a.diffAmount;
  if (amountDiff !== 0) return amountDiff;
  const wa = getWaitHours(a) ?? 0;
  const wb = getWaitHours(b) ?? 0;
  return wb - wa;
}

export function sortBySLAUrgency(a: ReconciliationDifference, b: ReconciliationDifference): number {
  const tierA = getSLATier(a);
  const tierB = getSLATier(b);
  const urgency: Record<SLATier, number> = { overdue: 3, warning: 2, normal: 1 };
  const ua = urgency[tierA];
  const ub = urgency[tierB];
  if (ua !== ub) return ub - ua;
  return sortWorkbenchDiffs(a, b);
}

// ====== 批次统计 ======

export function batchProgressStats(
  differences: ReconciliationDifference[],
  _pushRecordIds: Set<string>,
) {
  const total = differences.length;
  const completed = differences.filter(
    (d) => d.status === "COMPLETED" || d.status === "CONFIRMED" || d.status === "PROCESSED",
  ).length;
  const inProgress = differences.filter(
    (d) =>
      d.status !== "COMPLETED" &&
      d.status !== "CONFIRMED" &&
      d.status !== "PROCESSED" &&
      d.status !== "PENDING_ATTRIBUTION",
  ).length;

  // 进度按「已确认 / 总数」计算，进行中仅用于辅助展示，避免超过 100%
  const numerator = completed;
  const percent = total ? Math.round((numerator / total) * 100) : 0;
  return { total, completed, inProgress, numerator, percent };
}

// ====== SLA 计算 ======

export function getSLATier(diff: ReconciliationDifference): SLATier {
  const deadline = diff.slaDeadline;
  const warningAt = diff.slaWarningAt;
  const now = Date.now();

  if (deadline) {
    const deadlineMs = new Date(deadline).getTime();
    if (!Number.isNaN(deadlineMs)) {
      if (now > deadlineMs) return "overdue";
      if (warningAt) {
        const warningMs = new Date(warningAt).getTime();
        if (!Number.isNaN(warningMs) && now > warningMs) return "warning";
      }
    }
  }

  // 回退：使用 createdAt + 默认SLA
  const waitHours = getWaitHours(diff);
  if (waitHours !== null) {
    const config = slaDefaults.default;
    if (waitHours >= config.deadline) return "overdue";
    if (waitHours >= config.warning) return "warning";
  }

  return "normal";
}

export function getTimeRemaining(diff: ReconciliationDifference): { label: string; hours: number; isOverdue: boolean } {
  const tier = getSLATier(diff);
  const deadline = diff.slaDeadline;
  if (deadline) {
    const ms = new Date(deadline).getTime() - Date.now();
    const hours = Math.max(0, Math.round(ms / (1000 * 60 * 60)));
    if (tier === "overdue") return { label: "已超时", hours, isOverdue: true };
    if (tier === "warning") return { label: "即将超时", hours, isOverdue: false };
    return { label: "剩余", hours, isOverdue: false };
  }

  const waitHours = getWaitHours(diff);
  if (waitHours !== null) {
    const config = slaDefaults.default;
    const remaining = Math.max(0, config.deadline - waitHours);
    if (tier === "overdue") return { label: "已超时", hours: Math.max(0, waitHours - config.deadline), isOverdue: true };
    if (tier === "warning") return { label: "即将超时", hours: remaining, isOverdue: false };
    return { label: "剩余", hours: remaining, isOverdue: false };
  }

  return { label: "—", hours: 0, isOverdue: false };
}

// ====== 状态流转 ======

export function getValidNextStatuses(currentStatus: string): string[] {
  // 兼容旧状态名
  const mapped = currentStatus === "PENDING" ? "PENDING_ATTRIBUTION" : currentStatus;
  return statusTransitions[mapped] ?? [];
}

// ====== 治理分析 ======

export function computeGovernanceDistribution(diffs: ReconciliationDifference[]): Array<{
  level: string;
  label: string;
  count: number;
  percentage: number;
}> {
  const map = new Map<string, number>();
  const total = diffs.length || 1;

  diffs.forEach((d) => {
    const tags = d.governanceTags ?? [];
    if (d.governanceLevel) tags.push(d.governanceLevel);
    const uniqueLevels = new Set(tags.filter((t) => ["L1", "L2", "L3", "L4", "L5"].includes(t)));
    uniqueLevels.forEach((l) => map.set(l, (map.get(l) ?? 0) + 1));
  });

  const labels: Record<string, string> = { L1: "总数核对", L2: "明细核对", L3: "根因分析", L4: "流程治理", L5: "规则治理" };
  return ["L1", "L2", "L3", "L4", "L5"].map((level) => ({
    level,
    label: labels[level] ?? level,
    count: map.get(level) ?? 0,
    percentage: Math.round(((map.get(level) ?? 0) / total) * 100),
  }));
}

export function computeAttributionResultDistribution(diffs: ReconciliationDifference[]): Array<[string, number]> {
  const map = new Map<string, number>();
  diffs.forEach((d) => {
    const result = d.attributionResult ?? d.status;
    map.set(result, (map.get(result) ?? 0) + 1);
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

export function computeSystemDistribution(diffs: ReconciliationDifference[]): Array<{
  system: string;
  count: number;
  percentage: number;
}> {
  const map = new Map<string, number>();
  const total = diffs.length || 1;
  diffs.filter((d) => d.status !== "COMPLETED" && d.status !== "CONFIRMED" && d.status !== "PROCESSED").forEach((d) => {
    const key = d.ownerSystem ?? "未分配";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([system, count]) => ({ system, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export function computeCauseRanking(diffs: ReconciliationDifference[]): Array<{
  cause: string;
  count: number;
  trend: "up" | "down" | "stable";
}> {
  const map = new Map<string, number>();
  diffs.forEach((d) => {
    const cause = d.anomalyCause ?? d.attributionResult ?? "未确定";
    map.set(cause, (map.get(cause) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cause, count]) => ({ cause, count, trend: "stable" as const }));
}

export function computeGroupEfficiency(diffs: ReconciliationDifference[]): Array<{
  groupName: string;
  totalTasks: number;
  overdueCount: number;
  avgHours: number;
  onTimeRate: number;
}> {
  const groups = new Map<string, ReconciliationDifference[]>();
  diffs.forEach((d) => {
    const key = d.processingGroupName ?? d.ownerSystem ?? "未分配";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  });
  return Array.from(groups.entries()).map(([groupName, items]) => {
    const totalTasks = items.length;
    const overdueCount = items.filter((d) => getSLATier(d) === "overdue").length;
    const onTimeRate = totalTasks ? Math.round(((totalTasks - overdueCount) / totalTasks) * 100) : 100;
    const avgHours = items.length
      ? Math.round(items.reduce((sum, d) => sum + (getWaitHours(d) ?? 0), 0) / items.length)
      : 0;
    return { groupName, totalTasks, overdueCount, avgHours, onTimeRate };
  });
}

export function computeAttributionQuality(diffs: ReconciliationDifference[]): {
  autoAttributed: number;
  autoRate: number;
  manualCorrectionRate: number;
} {
  const total = diffs.length || 1;
  const autoAttributed = diffs.filter(
    (d) =>
      d.attributionResult &&
      d.attributionResult !== "PENDING_ATTRIBUTION",
  ).length;
  return {
    autoAttributed,
    autoRate: Math.round((autoAttributed / total) * 100),
    manualCorrectionRate: 12, // mock value
  };
}

// ====== 流程步骤映射 ======

/** 将差异状态映射到 7 步闭环流程的步骤索引 */
export function getFlowStepIndex(diff: ReconciliationDifference): number {
  switch (diff.status) {
    case "PENDING":
    case "PENDING_ATTRIBUTION":
      return 0; // 差异接入
    case "ATTRIBUTING":
      return 2; // 自动排查中
    case "NEEDS_REVIEW":
      return 3; // 证据核对 — Agent 完成，待人工
    case "FINANCE_CONFIRMED":
      return 4; // 生成证据链
    case "INSUFFICIENT_EVIDENCE":
      return 3; // 回到证据核对
    case "EVIDENCE_GATHERING":
      return 3; // 补充证据
    case "FORWARDED_TO_BUSINESS":
      return 5; // 转业务处理
    case "BUSINESS_PROCESSING":
      return 5; // 业务处理中
    case "BUSINESS_FEEDBACK":
      return 6; // 人工复核
    case "FINANCE_REVIEWING":
      return 6; // 财务终审
    case "COMPLETED":
    case "CONFIRMED":
    case "PROCESSED":
      return 7; // 完成闭环
    default:
      return 0;
  }
}

// ====== 筛选 ======

export function filterByGovernanceLevel(
  diffs: ReconciliationDifference[],
  level: GovernanceLevel,
): ReconciliationDifference[] {
  return diffs.filter((d) => {
    if (d.governanceLevel === level) return true;
    return (d.governanceTags ?? []).some((t) => t === level);
  });
}

