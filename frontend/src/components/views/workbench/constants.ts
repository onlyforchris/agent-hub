import type { AttributionResult, GovernanceTag, ProcessingGroup, ReconciliationCategory } from "@/src/types.ts";

// ====== 原有差异类型标签（向后兼容） ======

export const typeLabels: Record<string, string> = {
  MDM_ID_ANOMALY: "同结算单多 MDM ID",
  AMOUNT_DOUBLE: "收入金额翻倍",
  STATUS_MISMATCH: "SAP/DMS 状态回传不一致",
};

// ====== 归因结果标签与样式 (Section 5.1) ======

export const attributionResultLabels: Record<AttributionResult, string> = {
  PENDING_ATTRIBUTION: "待归因",
  NEEDS_REVIEW: "需复核",
  INSUFFICIENT_EVIDENCE: "证据不足",
  SYSTEM_DIFFERENCE: "系统差异",
  BIZ_OPERATION_ERROR: "业务操作错误",
  MASTER_DATA_ISSUE: "主数据问题",
  TIMING_DIFFERENCE: "时间差异",
  INTERFACE_SYNC_ANOMALY: "接口同步异常",
  RULE_CONFIG_ISSUE: "规则配置问题",
  NO_DIFFERENCE_FALSE_ALARM: "无差异/误报",
  CONFIRMED: "已确认",
};

export const attributionResultStyles: Record<AttributionResult, string> = {
  PENDING_ATTRIBUTION: "bg-slate-50 text-slate-600 border-slate-200",
  NEEDS_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  INSUFFICIENT_EVIDENCE: "bg-rose-50 text-rose-700 border-rose-200",
  SYSTEM_DIFFERENCE: "bg-purple-50 text-purple-700 border-purple-200",
  BIZ_OPERATION_ERROR: "bg-orange-50 text-orange-700 border-orange-200",
  MASTER_DATA_ISSUE: "bg-indigo-50 text-indigo-700 border-indigo-200",
  TIMING_DIFFERENCE: "bg-cyan-50 text-cyan-700 border-cyan-200",
  INTERFACE_SYNC_ANOMALY: "bg-red-50 text-red-700 border-red-200",
  RULE_CONFIG_ISSUE: "bg-yellow-50 text-yellow-700 border-yellow-200",
  NO_DIFFERENCE_FALSE_ALARM: "bg-gray-50 text-gray-600 border-gray-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ====== 完整状态标签与样式 (Section 4) ======

export const statusLabels: Record<string, string> = {
  // 新版状态
  PENDING_ATTRIBUTION: "待归因",
  ATTRIBUTING: "系统归因中",
  NEEDS_REVIEW: "需复核",
  FINANCE_CONFIRMED: "财务确认无误",
  CONFIRMED: "已确认",
  FORWARDED_TO_BUSINESS: "转业务处理",
  BUSINESS_PROCESSING: "业务处理中",
  BUSINESS_FEEDBACK: "业务已反馈",
  FINANCE_REVIEWING: "财务复核",
  INSUFFICIENT_EVIDENCE: "证据不足",
  EVIDENCE_GATHERING: "补充证据中",
  INSUFFICIENT_EVIDENCE_CLOSED: "证据不足结案",
  PROCESSED: "已处理",
  // 旧版兼容
  PENDING: "待归因",
  COMPLETED: "已确认",
};

export const statusStyles: Record<string, string> = {
  // 新版状态
  PENDING_ATTRIBUTION: "bg-slate-50 text-slate-600 border-slate-200",
  ATTRIBUTING: "bg-blue-50 text-blue-700 border-blue-200",
  NEEDS_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  FINANCE_CONFIRMED: "bg-teal-50 text-teal-700 border-teal-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FORWARDED_TO_BUSINESS: "bg-violet-50 text-violet-700 border-violet-200",
  BUSINESS_PROCESSING: "bg-sky-50 text-sky-700 border-sky-200",
  BUSINESS_FEEDBACK: "bg-lime-50 text-lime-700 border-lime-200",
  FINANCE_REVIEWING: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  INSUFFICIENT_EVIDENCE: "bg-rose-50 text-rose-700 border-rose-200",
  EVIDENCE_GATHERING: "bg-pink-50 text-pink-700 border-pink-200",
  INSUFFICIENT_EVIDENCE_CLOSED: "bg-slate-100 text-slate-700 border-slate-300",
  PROCESSED: "bg-green-50 text-green-700 border-green-200",
  // 旧版兼容
  PENDING: "bg-blue-50 text-blue-700 border-blue-100",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

// ====== 对账类型标签 (Section 6.1) ======

export const reconciliationTypeLabels: Record<ReconciliationCategory, string> = {
  REVENUE: "收入对账",
  AR: "往来对账",
  INVENTORY: "库存对账",
  SERVICE: "服务对账",
};

export const reconciliationTypeColors: Record<ReconciliationCategory, string> = {
  REVENUE: "bg-blue-50 text-blue-700 border-blue-200",
  AR: "bg-purple-50 text-purple-700 border-purple-200",
  INVENTORY: "bg-amber-50 text-amber-700 border-amber-200",
  SERVICE: "bg-teal-50 text-teal-700 border-teal-200",
};

// ====== 治理标签定义 (Section 5.2) ======

export const governanceTagDefinitions: GovernanceTag[] = [
  { id: "L1_TOTAL_CHECK", level: "L1", name: "总数核对", description: "对账批次总数核对差异" },
  { id: "L2_DETAIL_CHECK", level: "L2", name: "明细核对", description: "逐笔明细比对差异" },
  { id: "L3_ROOT_CAUSE", level: "L3", name: "根因分析", description: "差异根因定位与分析" },
  { id: "L4_PROCESS_GOV", level: "L4", name: "流程治理", description: "业务流程优化改进" },
  { id: "L5_RULE_GOV", level: "L5", name: "规则治理", description: "规则配置与自动归因优化" },
  { id: "INTERFACE_LOG", level: "L3", name: "接口日志", description: "接口同步日志追溯" },
  { id: "AUTO_DISPATCH", level: "L4", name: "自动派单", description: "自动派单至对应处理组" },
  { id: "MONTHLY_ALERT", level: "L1", name: "月结告警", description: "月结进度异常告警" },
  { id: "KNOWLEDGE_BASE", level: "L5", name: "知识沉淀", description: "案例知识沉淀与复用" },
];

export const governanceLevelColors: Record<string, string> = {
  L1: "bg-slate-100 text-slate-700 border-slate-300",
  L2: "bg-blue-100 text-blue-700 border-blue-300",
  L3: "bg-amber-100 text-amber-700 border-amber-300",
  L4: "bg-purple-100 text-purple-700 border-purple-300",
  L5: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

export const governanceLevelLabels: Record<string, string> = {
  L1: "L1 总数核对",
  L2: "L2 明细核对",
  L3: "L3 根因分析",
  L4: "L4 流程治理",
  L5: "L5 规则治理",
};

// ====== SLA 默认配置 (Section 7) ======

export const slaDefaults: Record<string, { warning: number; deadline: number }> = {
  default: { warning: 24, deadline: 48 },
  high_priority: { warning: 8, deadline: 24 },
  low_priority: { warning: 48, deadline: 72 },
};

// ====== 状态流转规则 (Section 4) ======

export const statusTransitions: Record<string, string[]> = {
  PENDING_ATTRIBUTION: ["ATTRIBUTING"],
  ATTRIBUTING: ["NEEDS_REVIEW"],
  NEEDS_REVIEW: ["CONFIRMED", "FORWARDED_TO_BUSINESS", "INSUFFICIENT_EVIDENCE_CLOSED"],
  FINANCE_CONFIRMED: ["CONFIRMED", "PROCESSED", "INSUFFICIENT_EVIDENCE_CLOSED"],
  CONFIRMED: [],
  FORWARDED_TO_BUSINESS: ["BUSINESS_PROCESSING"],
  BUSINESS_PROCESSING: ["BUSINESS_FEEDBACK"],
  BUSINESS_FEEDBACK: ["FINANCE_REVIEWING"],
  FINANCE_REVIEWING: ["CONFIRMED", "PROCESSED", "FORWARDED_TO_BUSINESS", "INSUFFICIENT_EVIDENCE_CLOSED"],
  INSUFFICIENT_EVIDENCE: [],
  EVIDENCE_GATHERING: [],
  INSUFFICIENT_EVIDENCE_CLOSED: ["PENDING_ATTRIBUTION"],
  PROCESSED: [],
};

// ====== 处理组 Mock 数据 (Section 3) ======

export const processingGroups: ProcessingGroup[] = [
  {
    id: "group-sap",
    name: "SAP 处理组",
    description: "负责 SAP 过账、凭证、开票相关异常处理",
    strategy: "MANUAL_CLAIM",
    members: [
      { userId: "sap-wang", userName: "王工", currentLoad: 3 },
      { userId: "sap-li", userName: "李工", currentLoad: 5 },
      { userId: "sap-zhao", userName: "赵工", currentLoad: 2 },
    ],
  },
  {
    id: "group-dms",
    name: "DMS 处理组",
    description: "负责 DMS 结算单、收入台账、经销商相关异常处理",
    strategy: "MANUAL_CLAIM",
    members: [
      { userId: "dms-zhang", userName: "张工", currentLoad: 4 },
      { userId: "dms-chen", userName: "陈工", currentLoad: 1 },
    ],
  },
  {
    id: "group-interface",
    name: "接口处理组",
    description: "负责系统间接口同步、重试、数据回传异常处理",
    strategy: "MANUAL_CLAIM",
    members: [
      { userId: "if-liu", userName: "刘工", currentLoad: 2 },
      { userId: "if-huang", userName: "黄工", currentLoad: 3 },
    ],
  },
];

// ====== 处理日志操作标签 ======

export const processingLogActionLabels: Record<string, string> = {
  SYSTEM_ATTRIBUTION: "系统归因",
  STATUS_CHANGE: "状态变更",
  FORWARDED: "转发",
  FINANCE_OPINION: "财务意见",
  BUSINESS_OPINION: "业务意见",
  EVIDENCE_SUPPLEMENT: "证据补充",
  REMINDER: "催办",
  TIMEOUT_ALERT: "超时告警",
  TRANSFER: "转办",
  CONFIRMATION: "确认闭环",
};

// ====== Tab 与筛选器 ======

export type WorkbenchTab = "overview" | "todo" | "confirm" | "list" | "progress" | "cases" | "compare" | "governance";

export type TodoFilter =
  | "all"
  | "NORMAL"
  | "PROCESSING"
  | "PENDING"
  | "PENDING_ATTRIBUTION"
  | "ATTRIBUTING"
  | "EVIDENCE_GATHERING"
  | "NEEDS_REVIEW"
  | "INSUFFICIENT_EVIDENCE_CLOSED"
  | "FORWARDED_TO_BUSINESS"
  | "BUSINESS_PROCESSING"
  | "BUSINESS_FEEDBACK"
  | "FINANCE_REVIEWING";

export const workbenchTabLabels: Record<WorkbenchTab, string> = {
  overview: "工作台总览",
  todo: "我的待办",
  confirm: "待我确认",
  list: "差异清单",
  progress: "月结进度",
  cases: "案例库",
  compare: "价值对比",
  governance: "治理分析",
};

// ====== 归因步骤 ======

export const closedLoopSteps = [
  "差异接入",
  "识别差异类型",
  "自动排查",
  "证据核对",
  "生成证据链",
  "生成说明报告",
  "人工复核",
];

export const analysisProgressSteps = [
  { id: "identify", label: "识别差异类型", detail: "匹配排查方案与规则集" },
  { id: "dms", label: "核对 DMS 结算单", detail: "查询结算单与收入台账" },
  { id: "sap", label: "核对 SAP 过账", detail: "比对凭证金额与过账状态" },
  { id: "mdm", label: "核对主数据", detail: "检查 MDM ID 与组织变更" },
  { id: "log", label: "核对接口日志", detail: "追溯回传与同步记录" },
  { id: "evidence", label: "生成证据链", detail: "串联跨系统核对结果" },
  { id: "report", label: "生成说明报告", detail: "基于脱敏摘要组织归因说明" },
];

export const similarCaseHints: Partial<Record<string, string>> = {
  MDM_ID_ANOMALY: "历史上 3 次同类差异，2 次为门店 MDM 变更导致",
  AMOUNT_DOUBLE: "历史上 5 次同类差异，4 次为收入台账重复插入",
  STATUS_MISMATCH: "历史上 4 次同类差异，3 次为回传接口超时重试",
};

