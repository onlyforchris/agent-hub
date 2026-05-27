// ====== 对账类型 (Section 6.1) ======

export type ReconciliationCategory = "REVENUE" | "AR" | "INVENTORY" | "SERVICE";

export const ReconciliationCategoryLabel: Record<ReconciliationCategory, string> = {
  REVENUE: "收入对账",
  AR: "往来对账",
  INVENTORY: "库存对账",
  SERVICE: "服务对账",
};

// ====== 归因结果类型 (Section 5.1) ======

export type AttributionResult =
  | "PENDING_ATTRIBUTION"
  | "NEEDS_REVIEW"
  | "INSUFFICIENT_EVIDENCE"
  | "SYSTEM_DIFFERENCE"
  | "BIZ_OPERATION_ERROR"
  | "MASTER_DATA_ISSUE"
  | "TIMING_DIFFERENCE"
  | "INTERFACE_SYNC_ANOMALY"
  | "RULE_CONFIG_ISSUE"
  | "NO_DIFFERENCE_FALSE_ALARM"
  | "CONFIRMED";

// ====== 状态模型 (Section 4) ======

export type ReconciliationStatus =
  | "PENDING_ATTRIBUTION"
  | "ATTRIBUTING"
  | "NEEDS_REVIEW"
  | "FINANCE_CONFIRMED"
  | "CONFIRMED"
  | "FORWARDED_TO_BUSINESS"
  | "BUSINESS_PROCESSING"
  | "BUSINESS_FEEDBACK"
  | "FINANCE_REVIEWING"
  | "INSUFFICIENT_EVIDENCE"
  | "EVIDENCE_GATHERING"
  | "INSUFFICIENT_EVIDENCE_CLOSED"
  | "PROCESSED";

// ====== 治理标签 (Section 5.2) ======

export type GovernanceLevel = "L1" | "L2" | "L3" | "L4" | "L5";

export interface GovernanceTag {
  id: string;
  level: GovernanceLevel;
  name: string;
  description: string;
}

// ====== SAP 数据详情 (Section 6.2) ======

export interface SAPPostingDetail {
  companyCode: string;
  fiscalYear: number;
  fiscalPeriod: number;
  documentNumber: string;
  documentLine: string;
  accountCode: string;
  accountName: string;
  customerCode?: string;
  customerName?: string;
  vendorCode?: string;
  vendorName?: string;
  amountInLocalCurrency: number;
  amountInDocumentCurrency: number;
  currency: string;
  taxAmount: number;
  profitCenter: string;
  costCenter: string;
  orderNumber?: string;
  contractNumber?: string;
  postingDate: string;
  documentDate: string;
  summary: string;
  postingStatus: string;
  billingStatus: string;
  cancelStatus: string;
  referenceDocNumber?: string;
}

// ====== DMS 数据详情 (Section 6.3) ======

export interface DMSRevenueDetail {
  orderNumber: string;
  dealerCode: string;
  dealerName: string;
  customerCode: string;
  customerName: string;
  businessType: string;
  orderStatus: string;
  settlementNumber: string;
  settlementStatus: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  amountExcludingTax: number;
  amountIncludingTax: number;
  taxAmount: number;
  taxRate: string;
  revenueRecognitionStatus: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

// ====== 集成日志 (Section 6.5) ======

export interface IntegrationLogSummary {
  sourceSystem: string;
  targetSystem: string;
  direction: string;
  dataCategory: string;
  syncBatchNo: string;
  callTime: string;
  status: string;
  failureReason?: string;
  messageDigest: string;
  retryCount: number;
  lastSyncTime?: string;
  relatedQualityReport?: string;
  relatedNotification?: string;
}

// ====== SLA (Section 7) ======

export type SLATier = "normal" | "warning" | "overdue";

export interface SLAConfig {
  diffType: string;
  warningHours: number;
  deadlineHours: number;
  businessDays?: number;
  escalationTiers: Array<{
    afterHours: number;
    action: "NOTIFY" | "ESCALATE_MANAGER" | "ESCALATE_DIRECTOR";
    notifyChannels: string[];
  }>;
}

// ====== 处理日志 (Section 7) ======

export type ProcessingLogAction =
  | "SYSTEM_ATTRIBUTION"
  | "STATUS_CHANGE"
  | "FORWARDED"
  | "FINANCE_OPINION"
  | "BUSINESS_OPINION"
  | "EVIDENCE_SUPPLEMENT"
  | "REMINDER"
  | "TIMEOUT_ALERT"
  | "TRANSFER"
  | "CONFIRMATION";

export interface ProcessingLogEntry {
  id: string;
  diffId: string;
  action: ProcessingLogAction;
  actor: string;
  actorRole: string;
  timestamp: string;
  content: string;
  attachments?: string[];
}

// ====== 处理组 (Section 3) ======

export type AssignmentStrategy = "MANUAL_CLAIM" | "LOAD_BALANCED" | "ROUND_ROBIN";

export interface ProcessingGroupMember {
  userId: string;
  userName: string;
  currentLoad: number;
}

export interface ProcessingGroup {
  id: string;
  name: string;
  description: string;
  strategy: AssignmentStrategy;
  members: ProcessingGroupMember[];
}

// ====== 治理分析 (Section 8) ======

export interface GovernanceAnalytics {
  governanceLevelDistribution: Array<{ level: GovernanceLevel; name: string; count: number; percentage: number }>;
  systemDistribution: Array<{ system: string; count: number; percentage: number }>;
  causeRanking: Array<{ cause: string; count: number; trend: "up" | "down" | "stable" }>;
  processingEfficiency: Array<{
    groupName: string;
    totalTasks: number;
    avgProcessingHours: number;
    overdueCount: number;
    onTimeRate: number;
  }>;
  autoAttributionRate: number;
  manualCorrectionRate: number;
  attributionAccuracy: number;
  repeatProblemCount: number;
  topRepeatProblems: Array<{ cause: string; count: number }>;
}

// ====== 核心实体：对账差异（扩展版） ======

export interface ReconciliationDifference {
  // 原有字段（向后兼容）
  id: string;
  billNo: string;
  type: "MDM_ID_ANOMALY" | "AMOUNT_DOUBLE" | "STATUS_MISMATCH";
  status: string;
  sapAmount: number;
  dmsAmount?: number;
  diffAmount: number;
  module: string;
  desc?: string;
  createdAt?: string;
  businessLine?: string;
  sourceSystem?: string;
  targetSystem?: string;
  ownerSystem?: string;
  createdAtLabel?: string;

  // 归因结果（Section 5.1）
  attributionResult?: AttributionResult;
  confidence?: number;
  anomalyCause?: string;

  // 对账元数据（Section 6.1）
  batchNo?: string;
  ruleName?: string;
  reconciliationType?: ReconciliationCategory;
  reconciliationPeriod?: string;
  reconciliationDate?: string;
  diffFields?: string[];
  syncSource?: string;
  syncTime?: string;

  // 治理标签（Section 5.2）
  governanceTags?: string[];
  governanceLevel?: GovernanceLevel;

  // 状态扩展
  previousStatus?: string;
  statusTimestamps?: Record<string, string>;

  // SLA
  slaDeadline?: string;
  slaWarningAt?: string;
  slaTier?: SLATier;
  lastRemindedAt?: string;
  escalationLevel?: number;

  // 处理分派
  processingGroupId?: string;
  processingGroupName?: string;
  handlerId?: string;
  handlerName?: string;
  assignedAt?: string;

  // 数据源详情（Section 6.2-6.5）
  sapDetail?: SAPPostingDetail;
  dmsDetail?: DMSRevenueDetail;
  integrationLogs?: IntegrationLogSummary[];

  // 处理日志
  processingLogs?: ProcessingLogEntry[];

  // 闭环
  closedAt?: string;
  closeReason?: string;
  isClosed?: boolean;
}

// ====== 以下为原有类型，保持不变 ======

export interface EvidenceItem {
  sourceSystem: string;
  checkField: string;
  expected: string;
  actual: string;
  result: "一致" | "不一致" | "命中异常" | "需复核";
}

export interface AnalysisResult {
  runId?: string;
  rootCause?: string;
  skillName?: string;
  confidence?: number;
  firstAbnormalNode?: string;
  evidenceChain?: EvidenceItem[];
  reviewSuggestion?: string;
  modelSummary?: string;
  auditNotes?: string[];
  evidence?: string[];
  report?: string;
  error?: string;
}

export type RunStepType = "plan" | "tool_call" | "rule" | "model" | "human" | "review_route";

export interface RunStep {
  seq: number;
  stepId: string;
  stepType: RunStepType;
  desc: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  ruleHit?: string;
  passed?: boolean;
  durationMs: number;
  createdAt: string;
}

export interface AgentRunSummary {
  id: string;
  agentCode: string;
  skillCode?: string;
  billNo: string;
  diffId: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "NEEDS_REVIEW";
  confidence?: number;
  rootCause?: string;
  firstAbnormalNode?: string;
  reviewRoutes?: string[];
  durationMs?: number;
  createdAt: string;
  finishedAt?: string;
  stepCount: number;
}

export interface AgentRunDetail extends AgentRunSummary {
  reportText?: string;
  steps: RunStep[];
}

export interface ToolMeta {
  name: string;
  version: string;
  category: string;
  description: string;
  connector: string;
  dataSensitivity: string;
  sideEffect: string;
  owner: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export type InterfaceHealthStatus = "healthy" | "warning" | "critical";
export type InterfaceLogStatus = "SUCCESS" | "FAIL" | "TIMEOUT" | "RETRYING";
export type InterfaceAlertStatus = "open" | "acknowledged" | "resolved";
export type InterfaceAlertSeverity = "low" | "medium" | "high" | "critical";

export interface BusinessSystem {
  code: string;
  name: string;
  ownerDept: string;
  ownerRole: string;
  status: InterfaceHealthStatus;
  interfaceCount: number;
  lastHeartbeatAt: string;
}

export interface InterfaceDefinition {
  code: string;
  name: string;
  sourceSystem: string;
  targetSystem: string;
  businessObject: string;
  frequency: "realtime" | "daily_batch" | "manual";
  ingestionMode: "API" | "ETL" | "API_ETL";
  dataScope: string;
  latestBatchNo: string;
  latestExtractAt: string;
  slaMinutes: number;
  owner: string;
  description: string;
}

export interface InterfaceLogRecord {
  id: string;
  interfaceCode: string;
  interfaceName: string;
  sourceSystem: string;
  targetSystem: string;
  businessKey: string;
  requestAt: string;
  responseAt?: string;
  durationMs: number;
  status: InterfaceLogStatus;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  payloadDigest: string;
  ingestionMode: "API" | "ETL" | "API_ETL";
  batchNo: string;
  extractedAt: string;
  originalBizDate: string;
  relatedDiffId?: string;
  relatedRunId?: string;
}

export interface InterfaceAlert {
  id: string;
  severity: InterfaceAlertSeverity;
  interfaceCode: string;
  interfaceName: string;
  businessKey?: string;
  title: string;
  reason: string;
  status: InterfaceAlertStatus;
  ownerRole: string;
  notifyChannels: Array<"in_app" | "dingtalk" | "email">;
  createdAt: string;
}

export interface InterfaceMonitorSummary {
  totalInterfaces: number;
  yesterdayLogCount: number;
  successRate: number;
  failureCount: number;
  timeoutCount: number;
  retryingCount: number;
  avgDurationMs: number;
  openAlerts: number;
  latestBatchNo: string;
  latestExtractAt: string;
  etlInterfaceCount: number;
  systemHealth: Array<{
    systemCode: string;
    status: InterfaceHealthStatus;
    successRate: number;
    failureCount: number;
  }>;
  interfaceHealth: Array<{
    interfaceCode: string;
    interfaceName: string;
    sourceSystem: string;
    targetSystem: string;
    status: InterfaceHealthStatus;
    successRate: number;
    failureCount: number;
    avgDurationMs: number;
  }>;
}
