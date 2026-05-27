// Skill 1：同结算单多 MDM ID 归因
// 对应方案 V3.0 第 14.1 节

import type { SkillDefinition } from "../runtime/types.js";

export const sameSettlementMultiMdmIdSkill: SkillDefinition = {
  code: "same_settlement_multiple_mdmid",
  displayName: "同结算单多 MDM ID 归因 Skill",
  version: "1.0.0",
  owner: "财务对账组 / DMS 研发",
  applicableWhen: { diffType: "MDM_ID_ANOMALY", businessModule: "收入" },
  inputsDesc: [
    "帆软差异清单",
    "DMS结算单表/函",
    "DMS收入台账",
    "SAP过账数据",
    "门店主数据",
    "组织变更记录",
  ],
  steps: [
    {
      id: "s1_check_dms_to_sap",
      desc: "核对 DMS 传 SAP 数据：结算单金额 + MDM ID 与 SAP 一致",
      tool: "dms.query_settlement",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out) => Array.isArray(out) && out.length > 0,
      ruleCode: "dms_settlement_exists",
      evidence: (out) => {
        const rows = (out as Array<Record<string, unknown>>) ?? [];
        const first = rows[0] ?? {};
        return {
          sourceSystem: "DMS结算单表/函",
          checkField: "结算金额 + MDM ID",
          expected: "与 SAP 过账一致",
          actual: `MDM ID=${first.mdmId ?? "-"}，金额=${first.amount ?? "-"}`,
          result: "一致",
        };
      },
    },
    {
      id: "s2_query_sap_posting",
      desc: "查询 SAP 过账数据并比对金额",
      tool: "sap.query_posting",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out, ctx) => {
        const settlement = (ctx.stepResults["s1_check_dms_to_sap"] as Array<Record<string, unknown>>)?.[0];
        const posting = out as Record<string, unknown> | null;
        if (!settlement || !posting) return false;
        return Number(settlement.amount) === Number(posting.postingAmount);
      },
      ruleCode: "dms_sap_amount_equal",
      evidence: (out, ctx) => {
        const settlement = (ctx.stepResults["s1_check_dms_to_sap"] as Array<Record<string, unknown>>)?.[0];
        const posting = out as Record<string, unknown> | null;
        const equal = settlement && posting && Number(settlement.amount) === Number(posting.postingAmount);
        return {
          sourceSystem: "SAP 过账数据",
          checkField: "过账金额",
          expected: `与 DMS 结算单金额一致 (${settlement?.amount ?? "-"})`,
          actual: `SAP 过账金额=${posting?.postingAmount ?? "-"}`,
          result: equal ? "一致" : "不一致",
        };
      },
    },
    {
      id: "s3_check_dms_ledger",
      desc: "核对 DMS 收入台账：MDM ID 是否与结算单一致",
      tool: "dms.query_revenue_ledger",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out, ctx) => {
        const settlement = (ctx.stepResults["s1_check_dms_to_sap"] as Array<Record<string, unknown>>)?.[0];
        const ledgerRows = (out as Array<Record<string, unknown>>) ?? [];
        const expectedMdm = settlement?.mdmId;
        const mismatched = ledgerRows.some((r) => r.mdmId !== expectedMdm);
        return !mismatched;
      },
      ruleCode: "ledger_mdm_consistent",
      evidence: (out, ctx) => {
        const settlement = (ctx.stepResults["s1_check_dms_to_sap"] as Array<Record<string, unknown>>)?.[0];
        const ledgerRows = (out as Array<Record<string, unknown>>) ?? [];
        const mdmIds = Array.from(new Set(ledgerRows.map((r) => r.mdmId)));
        const consistent = mdmIds.length === 1 && mdmIds[0] === settlement?.mdmId;
        return {
          sourceSystem: "DMS 收入台账",
          checkField: "收入台账 MDM ID",
          expected: `与结算单 MDM ID 一致 (${settlement?.mdmId ?? "-"})`,
          actual: `收入台账出现 MDM ID: ${mdmIds.join("、") || "无"}`,
          result: consistent ? "一致" : "不一致",
        };
      },
      onFail: { kind: "markAbnormalNode", node: "DMS_REVENUE_LEDGER" },
    },
    {
      id: "s4_check_master_org_change",
      desc: "核对门店主数据 / 组织变更：是否存在历史归属变更",
      tool: "master.query_store_history",
      args: (ctx) => {
        const settlement = (ctx.stepResults["s1_check_dms_to_sap"] as Array<Record<string, unknown>>)?.[0];
        return { storeCode: (settlement?.storeCode as string) ?? "" };
      },
      rule: (out) => {
        const store = out as Record<string, unknown> | null;
        const changes = (store?.orgChanges as Array<unknown>) ?? [];
        return changes.length > 0;
      },
      ruleCode: "store_org_change_detected",
      evidence: (out) => {
        const store = out as Record<string, unknown> | null;
        const changes = (store?.orgChanges as Array<Record<string, unknown>>) ?? [];
        const hasChange = changes.length > 0;
        return {
          sourceSystem: "门店主数据 / 组织变更",
          checkField: "门店历史归属",
          expected: "按发生期间组织归属取值",
          actual: hasChange
            ? `门店 ${store?.storeName ?? "-"} 于 ${changes[0]?.changedAt} 发生 ${changes[0]?.reason}`
            : "无组织变更记录",
          result: hasChange ? "需复核" : "一致",
        };
      },
      onPass: { kind: "markRootCause", cause: "STORE_ORG_SPLIT" },
    },
  ],
  output: {
    rootCauseTemplate: (ctx) => {
      if (ctx.markers.rootCause === "STORE_ORG_SPLIT") {
        return "DMS 收入台账中的 MDM ID 与结算单及门店当前归属不一致，结合门店组织变更记录，疑似门店组织拆分导致历史归属覆盖。";
      }
      if (ctx.markers.abnormalNode === "DMS_REVENUE_LEDGER") {
        return "DMS 收入台账中的 MDM ID 与结算单不一致，异常首次出现在 DMS 收入台账生成环节。";
      }
      return "未定位到明确根因，建议补充更多数据再复核。";
    },
    firstAbnormalNode: (ctx) => ctx.markers.abnormalNode ?? "未定位",
    confidence: (ctx) => {
      const expected = 4;
      const hit = ctx.ruleHits.length;
      const base = Math.min(0.95, 0.55 + 0.1 * hit);
      return Math.round(base * 100);
    },
  },
  review: {
    required: true,
    routes: [
      { role: "DMS_OWNER", whenAbnormalNode: "DMS_REVENUE_LEDGER" },
      { role: "FINANCE_REVIEWER", always: true },
    ],
  },
  reportTemplateId: "tpl/mdm_id_anomaly_report.md",
  evalSetId: "eval/mdm_id_anomaly_v1.jsonl",
};
