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

const systems: BusinessSystem[] = [
  {
    code: "FINEREPORT",
    name: "帆软差异清单",
    ownerDept: "财务数据治理组",
    ownerRole: "差异清单维护员",
    status: "healthy",
    interfaceCount: 1,
    lastHeartbeatAt: "2026-05-19T08:05:00+08:00",
  },
  {
    code: "DMS",
    name: "DMS 经销业务系统",
    ownerDept: "渠道业务 IT",
    ownerRole: "DMS 接口管理员",
    status: "warning",
    interfaceCount: 3,
    lastHeartbeatAt: "2026-05-19T08:12:00+08:00",
  },
  {
    code: "SAP",
    name: "SAP 财务系统",
    ownerDept: "财务信息化组",
    ownerRole: "SAP FI 接口管理员",
    status: "warning",
    interfaceCount: 3,
    lastHeartbeatAt: "2026-05-19T08:10:00+08:00",
  },
  {
    code: "MDM",
    name: "主数据平台",
    ownerDept: "数据治理组",
    ownerRole: "主数据管理员",
    status: "healthy",
    interfaceCount: 2,
    lastHeartbeatAt: "2026-05-19T08:00:00+08:00",
  },
];

const definitions: InterfaceDefinition[] = [
  {
    code: "FINEREPORT_DIFF_IMPORT",
    name: "帆软差异清单导入",
    sourceSystem: "FINEREPORT",
    targetSystem: "TAI_AGENT_HUB",
    businessObject: "差异单",
    frequency: "daily_batch",
    ingestionMode: "ETL",
    dataScope: "昨日收入对账差异清单",
    latestBatchNo: "BATCH-20260518",
    latestExtractAt: "2026-05-19T07:30:00+08:00",
    slaMinutes: 60,
    owner: "财务数据治理组",
    description: "每日接入帆软已识别的收入对账差异，作为 Agent 归因入口。",
  },
  {
    code: "DMS_SETTLEMENT_TO_SAP",
    name: "DMS 结算单推送 SAP",
    sourceSystem: "DMS",
    targetSystem: "SAP",
    businessObject: "结算单",
    frequency: "daily_batch",
    ingestionMode: "ETL",
    dataScope: "昨日 DMS 结算单推送 SAP 日志",
    latestBatchNo: "BATCH-20260518",
    latestExtractAt: "2026-05-19T08:10:00+08:00",
    slaMinutes: 120,
    owner: "渠道业务 IT / 财务信息化组",
    description: "将 DMS 结算单与收入数据推送到 SAP 进行财务过账。",
  },
  {
    code: "SAP_INVOICE_CALLBACK_TO_DMS",
    name: "SAP 开票状态回传 DMS",
    sourceSystem: "SAP",
    targetSystem: "DMS",
    businessObject: "开票状态",
    frequency: "realtime",
    ingestionMode: "API_ETL",
    dataScope: "关键错误实时接入，完整日志 T+1 抽取",
    latestBatchNo: "BATCH-20260518",
    latestExtractAt: "2026-05-19T08:20:00+08:00",
    slaMinutes: 15,
    owner: "财务信息化组",
    description: "SAP 完成开票或凭证处理后，把状态回传 DMS。",
  },
  {
    code: "SAP_POSTING_CALLBACK_TO_DMS",
    name: "SAP 过账结果回传 DMS",
    sourceSystem: "SAP",
    targetSystem: "DMS",
    businessObject: "过账结果",
    frequency: "realtime",
    ingestionMode: "API_ETL",
    dataScope: "关键错误实时接入，完整日志 T+1 抽取",
    latestBatchNo: "BATCH-20260518",
    latestExtractAt: "2026-05-19T08:20:00+08:00",
    slaMinutes: 15,
    owner: "财务信息化组",
    description: "SAP 过账成功、失败或冲销后，回写 DMS 结算单状态。",
  },
  {
    code: "MDM_STORE_SYNC_TO_DMS",
    name: "主数据门店映射同步 DMS",
    sourceSystem: "MDM",
    targetSystem: "DMS",
    businessObject: "门店主数据",
    frequency: "daily_batch",
    ingestionMode: "ETL",
    dataScope: "昨日门店与 MDM ID 变更记录",
    latestBatchNo: "BATCH-20260518",
    latestExtractAt: "2026-05-19T06:30:00+08:00",
    slaMinutes: 90,
    owner: "数据治理组",
    description: "同步门店、客户、MDM ID 映射关系，支撑结算归属判断。",
  },
];

let logs: InterfaceLogRecord[] = [
  {
    id: "LOG-20260519-0001",
    interfaceCode: "FINEREPORT_DIFF_IMPORT",
    interfaceName: "帆软差异清单导入",
    sourceSystem: "FINEREPORT",
    targetSystem: "TAI_AGENT_HUB",
    businessKey: "BATCH-20260518",
    requestAt: "2026-05-19T07:30:00+08:00",
    responseAt: "2026-05-19T07:31:08+08:00",
    durationMs: 68000,
    status: "SUCCESS",
    retryCount: 0,
    payloadDigest: "diff_count=128; module=income; hash=2d6a91",
    ingestionMode: "ETL",
    batchNo: "BATCH-20260518",
    extractedAt: "2026-05-19T07:30:00+08:00",
    originalBizDate: "2026-05-18",
  },
  {
    id: "LOG-20260519-0002",
    interfaceCode: "DMS_SETTLEMENT_TO_SAP",
    interfaceName: "DMS 结算单推送 SAP",
    sourceSystem: "DMS",
    targetSystem: "SAP",
    businessKey: "TCH202604160001",
    requestAt: "2026-05-19T08:15:21+08:00",
    responseAt: "2026-05-19T08:15:27+08:00",
    durationMs: 6200,
    status: "SUCCESS",
    retryCount: 0,
    payloadDigest: "settlementNo=TCH202604160001; amount=128000; hash=6c31b0",
    ingestionMode: "ETL",
    batchNo: "BATCH-20260518",
    extractedAt: "2026-05-19T08:10:00+08:00",
    originalBizDate: "2026-05-18",
    relatedDiffId: "DIFF001",
  },
  {
    id: "LOG-20260519-0003",
    interfaceCode: "SAP_INVOICE_CALLBACK_TO_DMS",
    interfaceName: "SAP 开票状态回传 DMS",
    sourceSystem: "SAP",
    targetSystem: "DMS",
    businessKey: "TCH202604160003",
    requestAt: "2026-05-19T08:21:01+08:00",
    responseAt: "2026-05-19T08:21:03+08:00",
    durationMs: 1800,
    status: "SUCCESS",
    retryCount: 0,
    payloadDigest: "invoiceStatus=SUCCESS; voucher=90018121; hash=81ac3e",
    ingestionMode: "ETL",
    batchNo: "BATCH-20260518",
    extractedAt: "2026-05-19T08:20:00+08:00",
    originalBizDate: "2026-05-18",
    relatedDiffId: "DIFF003",
  },
  {
    id: "LOG-20260519-0004",
    interfaceCode: "SAP_INVOICE_CALLBACK_TO_DMS",
    interfaceName: "SAP 开票状态回传 DMS",
    sourceSystem: "SAP",
    targetSystem: "DMS",
    businessKey: "TCH202604160005",
    requestAt: "2026-05-19T08:55:00+08:00",
    responseAt: "2026-05-19T08:55:30+08:00",
    durationMs: 30000,
    status: "TIMEOUT",
    errorCode: "TIMEOUT",
    errorMessage: "DMS callback timeout after 30s",
    retryCount: 3,
    payloadDigest: "invoiceStatus=SUCCESS; callback=timeout; hash=7cb902",
    ingestionMode: "API_ETL",
    batchNo: "BATCH-20260518",
    extractedAt: "2026-05-19T08:20:00+08:00",
    originalBizDate: "2026-05-18",
    relatedDiffId: "DIFF005",
  },
  {
    id: "LOG-20260519-0005",
    interfaceCode: "SAP_INVOICE_CALLBACK_TO_DMS",
    interfaceName: "SAP 开票状态回传 DMS",
    sourceSystem: "SAP",
    targetSystem: "DMS",
    businessKey: "TCH202604160005",
    requestAt: "2026-05-19T09:01:21+08:00",
    responseAt: "2026-05-19T09:01:26+08:00",
    durationMs: 5200,
    status: "FAIL",
    errorCode: "DMS_LOCK",
    errorMessage: "DMS settlement row locked by user task",
    retryCount: 3,
    payloadDigest: "invoiceStatus=SUCCESS; lock=row; hash=f1a330",
    ingestionMode: "API_ETL",
    batchNo: "BATCH-20260518",
    extractedAt: "2026-05-19T08:20:00+08:00",
    originalBizDate: "2026-05-18",
    relatedDiffId: "DIFF005",
  },
  {
    id: "LOG-20260519-0006",
    interfaceCode: "SAP_POSTING_CALLBACK_TO_DMS",
    interfaceName: "SAP 过账结果回传 DMS",
    sourceSystem: "SAP",
    targetSystem: "DMS",
    businessKey: "TCH202604160008",
    requestAt: "2026-05-19T09:42:10+08:00",
    responseAt: "2026-05-19T09:42:15+08:00",
    durationMs: 5000,
    status: "FAIL",
    errorCode: "MISSING_FX_RATE",
    errorMessage: "出口业务汇率主数据未维护",
    retryCount: 3,
    payloadDigest: "postingStatus=FAIL; reason=fx_rate; hash=4a202d",
    ingestionMode: "API_ETL",
    batchNo: "BATCH-20260518",
    extractedAt: "2026-05-19T08:20:00+08:00",
    originalBizDate: "2026-05-18",
    relatedDiffId: "DIFF008",
  },
  {
    id: "LOG-20260519-0007",
    interfaceCode: "MDM_STORE_SYNC_TO_DMS",
    interfaceName: "主数据门店映射同步 DMS",
    sourceSystem: "MDM",
    targetSystem: "DMS",
    businessKey: "STORE-BATCH-20260519",
    requestAt: "2026-05-19T06:30:00+08:00",
    responseAt: "2026-05-19T06:34:42+08:00",
    durationMs: 282000,
    status: "SUCCESS",
    retryCount: 0,
    payloadDigest: "store_count=2841; changed=16; hash=ca9820",
    ingestionMode: "ETL",
    batchNo: "BATCH-20260518",
    extractedAt: "2026-05-19T06:30:00+08:00",
    originalBizDate: "2026-05-18",
  },
  {
    id: "LOG-20260519-0008",
    interfaceCode: "DMS_SETTLEMENT_TO_SAP",
    interfaceName: "DMS 结算单推送 SAP",
    sourceSystem: "DMS",
    targetSystem: "SAP",
    businessKey: "TCH202604160011",
    requestAt: "2026-05-19T10:05:41+08:00",
    durationMs: 0,
    status: "RETRYING",
    errorCode: "SAP_QUEUE_BUSY",
    errorMessage: "SAP inbound queue is busy, waiting for retry window",
    retryCount: 2,
    payloadDigest: "settlementNo=TCH202604160011; amount=46800; hash=b912ad",
    ingestionMode: "API_ETL",
    batchNo: "BATCH-20260518",
    extractedAt: "2026-05-19T08:10:00+08:00",
    originalBizDate: "2026-05-18",
  },
];

let alerts: InterfaceAlert[] = [
  {
    id: "ALERT-20260519-001",
    severity: "high",
    interfaceCode: "SAP_INVOICE_CALLBACK_TO_DMS",
    interfaceName: "SAP 开票状态回传 DMS",
    businessKey: "TCH202604160005",
    title: "SAP 开票状态回传 DMS 连续失败",
    reason: "同一结算单在 6 分钟内出现 TIMEOUT 与 DMS_LOCK，已重试 3 次，可能影响 DMS 状态同步与对账归因。",
    status: "open",
    ownerRole: "财务信息化组 / DMS 接口管理员",
    notifyChannels: ["in_app", "dingtalk"],
    createdAt: "2026-05-19T09:03:00+08:00",
  },
  {
    id: "ALERT-20260519-002",
    severity: "medium",
    interfaceCode: "DMS_SETTLEMENT_TO_SAP",
    interfaceName: "DMS 结算单推送 SAP",
    businessKey: "TCH202604160011",
    title: "DMS 推送 SAP 队列等待重试",
    reason: "SAP 入站队列繁忙，接口处于 RETRYING 状态，超过 15 分钟未成功需提醒接口责任人。",
    status: "open",
    ownerRole: "渠道业务 IT / 财务信息化组",
    notifyChannels: ["in_app"],
    createdAt: "2026-05-19T10:08:00+08:00",
  },
  {
    id: "ALERT-20260519-003",
    severity: "medium",
    interfaceCode: "SAP_POSTING_CALLBACK_TO_DMS",
    interfaceName: "SAP 过账结果回传 DMS",
    businessKey: "TCH202604160008",
    title: "SAP 过账结果回传失败",
    reason: "出口业务汇率主数据未维护，SAP 回传失败，可作为后续差异归因的直接证据。",
    status: "acknowledged",
    ownerRole: "数据治理组 / 财务信息化组",
    notifyChannels: ["in_app", "email"],
    createdAt: "2026-05-19T09:45:00+08:00",
  },
];

export function listBusinessSystems(): BusinessSystem[] {
  return systems;
}

export function listInterfaceDefinitions(): InterfaceDefinition[] {
  return definitions;
}

export function listInterfaceLogs(filters: {
  system?: string;
  interfaceCode?: string;
  status?: string;
  businessKey?: string;
  from?: string;
  to?: string;
}): InterfaceLogRecord[] {
  return logs
    .filter((log) => {
      if (filters.system && log.sourceSystem !== filters.system && log.targetSystem !== filters.system) return false;
      if (filters.interfaceCode && log.interfaceCode !== filters.interfaceCode) return false;
      if (filters.status && log.status !== filters.status) return false;
      if (filters.businessKey && !log.businessKey.toLowerCase().includes(filters.businessKey.toLowerCase())) return false;
      if (filters.from && log.requestAt < filters.from) return false;
      if (filters.to && log.requestAt > filters.to) return false;
      return true;
    })
    .sort((a, b) => b.requestAt.localeCompare(a.requestAt));
}

export function getInterfaceLog(id: string): InterfaceLogRecord | undefined {
  return logs.find((log) => log.id === id);
}

export function listRelatedInterfaceLogs(businessKey: string): InterfaceLogRecord[] {
  return logs
    .filter((log) => log.businessKey === businessKey || log.relatedDiffId === businessKey)
    .sort((a, b) => a.requestAt.localeCompare(b.requestAt));
}

export function listInterfaceAlerts(): InterfaceAlert[] {
  return alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function acknowledgeInterfaceAlert(id: string): InterfaceAlert | undefined {
  alerts = alerts.map((alert) =>
    alert.id === id ? { ...alert, status: "acknowledged" } : alert,
  );
  return alerts.find((alert) => alert.id === id);
}

export function getInterfaceMonitorSummary(): InterfaceMonitorSummary {
  const totalCalls = logs.length;
  const failureLogs = logs.filter((log) => log.status === "FAIL" || log.status === "TIMEOUT");
  const timeoutCount = logs.filter((log) => log.status === "TIMEOUT").length;
  const retryingCount = logs.filter((log) => log.status === "RETRYING").length;
  const successCount = logs.filter((log) => log.status === "SUCCESS").length;
  const avgDurationMs =
    totalCalls === 0 ? 0 : Math.round(logs.reduce((sum, log) => sum + log.durationMs, 0) / totalCalls);

  return {
    totalInterfaces: definitions.length,
    yesterdayLogCount: totalCalls,
    successRate: totalCalls === 0 ? 0 : Math.round((successCount / totalCalls) * 1000) / 10,
    failureCount: failureLogs.length,
    timeoutCount,
    retryingCount,
    avgDurationMs,
    openAlerts: alerts.filter((alert) => alert.status === "open").length,
    latestBatchNo: "BATCH-20260518",
    latestExtractAt: "2026-05-19T08:20:00+08:00",
    etlInterfaceCount: definitions.filter((definition) => definition.ingestionMode === "ETL" || definition.ingestionMode === "API_ETL").length,
    systemHealth: systems.map((system) => {
      const systemLogs = logs.filter((log) => log.sourceSystem === system.code || log.targetSystem === system.code);
      const systemFailures = systemLogs.filter((log) => log.status === "FAIL" || log.status === "TIMEOUT").length;
      const systemSuccess = systemLogs.filter((log) => log.status === "SUCCESS").length;
      const successRate = systemLogs.length === 0 ? 100 : Math.round((systemSuccess / systemLogs.length) * 1000) / 10;
      return {
        systemCode: system.code,
        status: deriveStatus(systemFailures, systemLogs.some((log) => log.status === "RETRYING")),
        successRate,
        failureCount: systemFailures,
      };
    }),
    interfaceHealth: definitions.map((definition) => {
      const interfaceLogs = logs.filter((log) => log.interfaceCode === definition.code);
      const interfaceFailures = interfaceLogs.filter((log) => log.status === "FAIL" || log.status === "TIMEOUT").length;
      const interfaceSuccess = interfaceLogs.filter((log) => log.status === "SUCCESS").length;
      const avgMs =
        interfaceLogs.length === 0
          ? 0
          : Math.round(interfaceLogs.reduce((sum, log) => sum + log.durationMs, 0) / interfaceLogs.length);
      return {
        interfaceCode: definition.code,
        interfaceName: definition.name,
        sourceSystem: definition.sourceSystem,
        targetSystem: definition.targetSystem,
        status: deriveStatus(interfaceFailures, interfaceLogs.some((log) => log.status === "RETRYING")),
        successRate: interfaceLogs.length === 0 ? 100 : Math.round((interfaceSuccess / interfaceLogs.length) * 1000) / 10,
        failureCount: interfaceFailures,
        avgDurationMs: avgMs,
      };
    }),
  };
}

function deriveStatus(failureCount: number, hasRetrying: boolean): InterfaceHealthStatus {
  if (failureCount >= 2) return "critical";
  if (failureCount === 1 || hasRetrying) return "warning";
  return "healthy";
}
