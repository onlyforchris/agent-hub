// Tool Registry：所有 Tool 在此注册，Skill 通过 name 调用
// 对应方案 V3.0 第 7 章 Tool 协议

import { connectors } from "../connectors";
import type { ToolDefinition } from "../runtime/types.js";

const tools: Record<string, ToolDefinition> = {};

function register(tool: ToolDefinition): void {
  tools[tool.name] = tool;
}

export function getTool(name: string): ToolDefinition {
  const t = tools[name];
  if (!t) throw new Error(`Tool not found: ${name}`);
  return t;
}

export function listTools(): ToolDefinition[] {
  return Object.values(tools);
}

// ============== Tool 注册：数据查询 ==============

register({
  name: "finereport.query_diff_list",
  version: "1.0.0",
  category: "data_query",
  description: "按批次/模块拉取帆软差异清单",
  inputSchema: { type: "object", properties: { module: { type: "string" } } },
  outputSchema: { type: "array" },
  dataSensitivity: "internal_finance",
  sideEffect: "none",
  connector: "excel_import",
  owner: "帆软对账组",
  invoke: async () => connectors.finereport.queryDiffList(),
});

register({
  name: "dms.query_settlement",
  version: "1.0.0",
  category: "data_query",
  description: "按结算单号查询 DMS 结算单（头/函）",
  inputSchema: {
    type: "object",
    required: ["settlementNo"],
    properties: { settlementNo: { type: "string" } },
  },
  outputSchema: { type: "array" },
  dataSensitivity: "internal_finance",
  sideEffect: "none",
  connector: "excel_import",
  owner: "DMS 研发组",
  invoke: async (args) => connectors.dms.querySettlement(args.settlementNo as string),
});

register({
  name: "dms.query_revenue_ledger",
  version: "1.2.0",
  category: "data_query",
  description: "按结算单号查询 DMS 收入台账的所有记录",
  inputSchema: {
    type: "object",
    required: ["settlementNo"],
    properties: { settlementNo: { type: "string" } },
  },
  outputSchema: { type: "array" },
  dataSensitivity: "internal_finance",
  sideEffect: "none",
  connector: "excel_import",
  owner: "DMS 研发组",
  invoke: async (args) => connectors.dms.queryRevenueLedger(args.settlementNo as string),
});

register({
  name: "sap.query_posting",
  version: "1.0.0",
  category: "data_query",
  description: "按结算单号查询 SAP 过账与凭证数据",
  inputSchema: {
    type: "object",
    required: ["settlementNo"],
    properties: { settlementNo: { type: "string" } },
  },
  outputSchema: { type: "object" },
  dataSensitivity: "internal_finance",
  sideEffect: "none",
  connector: "excel_import",
  owner: "SAP 研发组",
  invoke: async (args) => connectors.sap.queryPosting(args.settlementNo as string),
});

register({
  name: "sap.query_interface_log",
  version: "1.0.0",
  category: "data_query",
  description: "查询 SAP → DMS 回传接口日志",
  inputSchema: {
    type: "object",
    required: ["settlementNo"],
    properties: { settlementNo: { type: "string" } },
  },
  outputSchema: { type: "array" },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "excel_import",
  owner: "中间件团队",
  invoke: async (args) => connectors.sap.queryInterfaceLog(args.settlementNo as string),
});

register({
  name: "master.query_store_history",
  version: "1.0.0",
  category: "data_query",
  description: "查询门店主数据与组织变更历史",
  inputSchema: {
    type: "object",
    required: ["storeCode"],
    properties: { storeCode: { type: "string" } },
  },
  outputSchema: { type: "object" },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "excel_import",
  owner: "主数据组",
  invoke: async (args) => connectors.master.queryStoreHistory(args.storeCode as string),
});

// ============== Tool 注册：规则计算 ==============

register({
  name: "rule.eval_amount_compare",
  version: "1.0.0",
  category: "rule",
  description: "金额一致性 / 翻倍 / 比例校验",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "rule_engine",
  owner: "对账规则组",
  invoke: async (args) => {
    const a = Number(args.a ?? 0);
    const b = Number(args.b ?? 0);
    const tolerance = Number(args.tolerance ?? 0.01);
    const ratio = b === 0 ? null : a / b;
    return {
      equal: Math.abs(a - b) <= tolerance,
      doubled: ratio !== null && Math.abs(ratio - 2) <= 0.05,
      ratio,
      diff: a - b,
    };
  },
});

register({
  name: "rule.detect_duplicate",
  version: "1.0.0",
  category: "rule",
  description: "识别同结算单/同金额/相近时间的重复记录",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "rule_engine",
  owner: "对账规则组",
  invoke: async (args) => {
    const rows = (args.rows as Array<Record<string, unknown>>) ?? [];
    const byKey = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.settlementNo}__${row.amount}`;
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    const duplicates: Array<{ key: string; count: number }> = [];
    for (const [key, count] of byKey.entries()) {
      if (count > 1) duplicates.push({ key, count });
    }
    return { hasDuplicate: duplicates.length > 0, duplicates };
  },
});

register({
  name: "rule.eval_status_matrix",
  version: "1.0.0",
  category: "rule",
  description: "SAP/DMS 状态组合校验",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "rule_engine",
  owner: "对账规则组",
  invoke: async (args) => {
    const sap = (args.sap as Record<string, unknown>) ?? {};
    const dms = (args.dms as Record<string, unknown>) ?? {};
    const sapPosted = sap.postingStatus === "已过账";
    const sapBilled = sap.billingStatus === "已开票";
    const dmsPosted = dms.postingStatus === "已过账";
    const dmsBilled = dms.billingStatus === "已开票";
    return {
      sapPosted,
      sapBilled,
      dmsPosted,
      dmsBilled,
      mismatch: (sapPosted && !dmsPosted) || (sapBilled && !dmsBilled),
    };
  },
});

register({
  name: "rule.eval_threshold_alert",
  version: "1.1.0",
  category: "rule",
  description: "差异金额阈值告警规则：超过单/批次阈值判定为高优先级",
  inputSchema: {
    type: "object",
    required: ["diffAmount"],
    properties: {
      diffAmount: { type: "number", description: "差异金额（元）" },
      singleThreshold: { type: "number", description: "单笔阈值，默认 5000" },
      batchTotal: { type: "number", description: "本批次差异累计金额（元）" },
      batchThreshold: { type: "number", description: "批次阈值，默认 50000" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      level: { type: "string" },
      hitSingle: { type: "boolean" },
      hitBatch: { type: "boolean" },
    },
  },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "rule_engine",
  owner: "对账规则组",
  invoke: async (args) => {
    const diff = Number(args.diffAmount ?? 0);
    const single = Number(args.singleThreshold ?? 5000);
    const batchTotal = Number(args.batchTotal ?? 0);
    const batchThreshold = Number(args.batchThreshold ?? 50000);
    const hitSingle = diff >= single;
    const hitBatch = batchTotal >= batchThreshold;
    let level: "INFO" | "WARN" | "CRITICAL" = "INFO";
    if (hitSingle && hitBatch) level = "CRITICAL";
    else if (hitSingle || hitBatch) level = "WARN";
    return { level, hitSingle, hitBatch, diffAmount: diff, batchTotal };
  },
});

// ============== Tool 注册：数据查询（扩展示例） ==============

register({
  name: "dms.query_customer_master",
  version: "1.0.0",
  category: "data_query",
  description: "按客户号查询 DMS 客户主数据（含 MDM 映射与组织归属）",
  inputSchema: {
    type: "object",
    required: ["customerCode"],
    properties: { customerCode: { type: "string" } },
  },
  outputSchema: { type: "object" },
  dataSensitivity: "internal_finance",
  sideEffect: "none",
  connector: "excel_import",
  owner: "DMS 研发组",
  invoke: async (args) => ({
    customerCode: args.customerCode,
    mdmId: "MDM_" + String(args.customerCode ?? "").slice(-4),
    orgUnit: "华东大区",
    activeFrom: "2024-01-01",
    activeTo: null,
  }),
});

register({
  name: "sap.query_billing_doc",
  version: "1.0.0",
  category: "data_query",
  description: "按结算单号查询 SAP 开票凭证（VBRK/VBRP）",
  inputSchema: {
    type: "object",
    required: ["settlementNo"],
    properties: { settlementNo: { type: "string" } },
  },
  outputSchema: { type: "array" },
  dataSensitivity: "internal_finance",
  sideEffect: "none",
  connector: "excel_import",
  owner: "SAP 研发组",
  invoke: async (args) => [
    {
      billingDoc: "9100" + String(args.settlementNo ?? "").slice(-4),
      docType: "ZF2",
      billingAmount: 0,
      currency: "CNY",
      billingDate: "2026-04-15",
      status: "已开票",
    },
  ],
});

register({
  name: "finereport.query_batch_summary",
  version: "1.0.0",
  category: "data_query",
  description: "按批次拉取帆软差异汇总（差异笔数、累计金额、命中规则分布）",
  inputSchema: {
    type: "object",
    properties: {
      batchId: { type: "string", description: "批次号，例如 2026-04 月结" },
    },
  },
  outputSchema: { type: "object" },
  dataSensitivity: "internal_finance",
  sideEffect: "none",
  connector: "excel_import",
  owner: "帆软对账组",
  invoke: async (args) => ({
    batchId: args.batchId ?? "2026-04",
    diffCount: 17,
    totalDiffAmount: 128430,
    byType: { MDM_ID_ANOMALY: 5, AMOUNT_DOUBLE: 6, STATUS_MISMATCH: 6 },
  }),
});

// ============== Tool 注册：计算辅助 (compute) ==============

register({
  name: "compute.calc_amount_diff",
  version: "1.0.0",
  category: "compute",
  description: "计算 SAP 与 DMS 金额差异（差值 / 差异率 / 是否翻倍）",
  inputSchema: {
    type: "object",
    required: ["sapAmount", "dmsAmount"],
    properties: {
      sapAmount: { type: "number" },
      dmsAmount: { type: "number" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      diff: { type: "number" },
      ratio: { type: "number" },
      doubled: { type: "boolean" },
    },
  },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "compute_engine",
  owner: "对账规则组",
  invoke: async (args) => {
    const sap = Number(args.sapAmount ?? 0);
    const dms = Number(args.dmsAmount ?? 0);
    const diff = dms - sap;
    const ratio = sap === 0 ? null : dms / sap;
    const doubled = ratio !== null && Math.abs(ratio - 2) <= 0.05;
    return { diff, ratio, doubled, sap, dms };
  },
});

register({
  name: "compute.aggregate_by_module",
  version: "1.0.0",
  category: "compute",
  description: "按业务模块聚合差异清单，输出每模块差异笔数 / 累计金额",
  inputSchema: {
    type: "object",
    required: ["rows"],
    properties: {
      rows: { type: "array" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      byModule: { type: "object" },
      total: { type: "number" },
    },
  },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "compute_engine",
  owner: "对账规则组",
  invoke: async (args) => {
    const rows = (args.rows as Array<Record<string, unknown>>) ?? [];
    const byModule: Record<string, { count: number; totalDiff: number }> = {};
    let total = 0;
    for (const r of rows) {
      const m = String(r.module ?? "未分类");
      const amt = Number(r.diffAmount ?? 0);
      byModule[m] = byModule[m] ?? { count: 0, totalDiff: 0 };
      byModule[m].count += 1;
      byModule[m].totalDiff += amt;
      total += amt;
    }
    return { byModule, total };
  },
});

// ============== Tool 注册：报告模板 (template) ==============

register({
  name: "template.render_attribution_report",
  version: "1.2.0",
  category: "template",
  description: "按归因报告模板渲染最终 Markdown 报告（含证据链、根因与复核建议）",
  inputSchema: {
    type: "object",
    required: ["skillCode", "rootCause", "evidence"],
    properties: {
      skillCode: { type: "string" },
      rootCause: { type: "string" },
      firstAbnormalNode: { type: "string" },
      confidence: { type: "number" },
      evidence: { type: "array" },
      reviewRoutes: { type: "array" },
    },
  },
  outputSchema: {
    type: "object",
    properties: { markdown: { type: "string" } },
  },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "template_engine",
  owner: "平台前端组",
  invoke: async (args) => {
    const skillCode = String(args.skillCode ?? "-");
    const rootCause = String(args.rootCause ?? "-");
    const firstAbnormalNode = String(args.firstAbnormalNode ?? "-");
    const confidence = Number(args.confidence ?? 0);
    const evidence = (args.evidence as Array<Record<string, unknown>>) ?? [];
    const reviewRoutes = (args.reviewRoutes as string[]) ?? [];
    const evidenceLines = evidence
      .map((e, i) => `${i + 1}. [${e.sourceSystem}] ${e.checkField} → ${e.result}`)
      .join("\n");
    const md = [
      `# 归因报告（脱敏）`,
      ``,
      `- 命中 Skill：${skillCode}`,
      `- 首次异常环节：${firstAbnormalNode}`,
      `- 置信度：${confidence}%`,
      ``,
      `## 根因结论`,
      rootCause,
      ``,
      `## 证据链摘要`,
      evidenceLines || "（无）",
      ``,
      `## 复核路由`,
      reviewRoutes.length ? reviewRoutes.map((r) => `- ${r}`).join("\n") : "- FINANCE_REVIEWER",
    ].join("\n");
    return { markdown: md };
  },
});

register({
  name: "template.render_review_summary",
  version: "1.0.0",
  category: "template",
  description: "渲染人工复核摘要卡片（用于站内通知与邮件附件）",
  inputSchema: {
    type: "object",
    required: ["billNo", "rootCause"],
    properties: {
      billNo: { type: "string" },
      rootCause: { type: "string" },
      reviewRoutes: { type: "array" },
      dueDate: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
  },
  dataSensitivity: "internal",
  sideEffect: "none",
  connector: "template_engine",
  owner: "平台前端组",
  invoke: async (args) => {
    const routes = ((args.reviewRoutes as string[]) ?? []).join("、") || "FINANCE_REVIEWER";
    const text = `【复核任务】单据 ${args.billNo}\n根因：${args.rootCause}\n复核角色：${routes}\n截止：${args.dueDate ?? "T+1"}`;
    return { text };
  },
});

// ============== Tool 注册：通知 (notify) ==============

register({
  name: "notify.send_review_request",
  version: "1.0.0",
  category: "notify",
  description: "向责任系统 Owner 推送复核任务（站内 + 企业微信），仅发送脱敏摘要",
  inputSchema: {
    type: "object",
    required: ["billNo", "reviewRoutes"],
    properties: {
      billNo: { type: "string" },
      reviewRoutes: { type: "array" },
      summary: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: { delivered: { type: "boolean" }, channel: { type: "string" } },
  },
  dataSensitivity: "internal",
  sideEffect: "notify",
  connector: "wecom_bot",
  owner: "消息调度组",
  allowedRoles: ["FINANCE_REVIEWER", "PLATFORM_ADMIN"],
  invoke: async (args) => ({
    delivered: true,
    channel: "wecom",
    billNo: args.billNo,
    notifiedRoles: args.reviewRoutes,
  }),
});

register({
  name: "notify.email_finance_summary",
  version: "1.0.0",
  category: "notify",
  description: "按月度向财务负责人邮件推送差异汇总（含归因结果分布）",
  inputSchema: {
    type: "object",
    required: ["batchId", "recipients"],
    properties: {
      batchId: { type: "string" },
      recipients: { type: "array" },
      summary: { type: "object" },
    },
  },
  outputSchema: {
    type: "object",
    properties: { delivered: { type: "boolean" }, messageId: { type: "string" } },
  },
  dataSensitivity: "internal_finance",
  sideEffect: "notify",
  connector: "smtp_relay",
  owner: "消息调度组",
  allowedRoles: ["FINANCE_REVIEWER", "FINANCE_DIRECTOR"],
  invoke: async (args) => ({
    delivered: true,
    messageId: `msg_${Date.now()}`,
    batchId: args.batchId,
    recipientCount: ((args.recipients as unknown[]) ?? []).length,
  }),
});
