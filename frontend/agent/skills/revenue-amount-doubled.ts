// Skill 2：收入金额翻倍归因
// 对应方案 V3.0 第 14.2 节

import type { SkillDefinition } from "../runtime/types.js";

export const revenueAmountDoubledSkill: SkillDefinition = {
  code: "revenue_amount_doubled",
  displayName: "收入金额翻倍归因 Skill",
  version: "1.0.0",
  owner: "财务对账组 / DMS 研发",
  applicableWhen: { diffType: "AMOUNT_DOUBLE", businessModule: "收入" },
  inputsDesc: [
    "帆软差异清单",
    "DMS结算单",
    "DMS收入台账",
    "SAP过账数据",
  ],
  steps: [
    {
      id: "s1_check_ratio",
      desc: "识别金额异常：DMS / SAP 比例是否接近 2",
      tool: "rule.eval_amount_compare",
      args: (ctx) => ({ a: ctx.diff.dmsAmount, b: ctx.diff.sapAmount }),
      rule: (out) => Boolean((out as { doubled: boolean })?.doubled),
      ruleCode: "amount_doubled_detected",
      evidence: (out, ctx) => {
        const r = out as { ratio: number | null; doubled: boolean };
        return {
          sourceSystem: "帆软收入总额核对",
          checkField: "DMS / SAP 比例",
          expected: "比例接近 1.00",
          actual: `DMS=${ctx.diff.dmsAmount}，SAP=${ctx.diff.sapAmount}，比例≈${r.ratio?.toFixed(2) ?? "-"}`,
          result: r.doubled ? "命中异常" : "一致",
        };
      },
    },
    {
      id: "s2_check_dms_settlement",
      desc: "核对 DMS 结算单金额：是否与 SAP 一致",
      tool: "dms.query_settlement",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out, ctx) => {
        const rows = (out as Array<Record<string, unknown>>) ?? [];
        const first = rows[0];
        return Number(first?.amount) === ctx.diff.sapAmount;
      },
      ruleCode: "settlement_equals_sap",
      evidence: (out, ctx) => {
        const rows = (out as Array<Record<string, unknown>>) ?? [];
        const first = rows[0] ?? {};
        const equal = Number(first?.amount) === ctx.diff.sapAmount;
        return {
          sourceSystem: "DMS 结算单",
          checkField: "结算单金额",
          expected: `与 SAP 一致 (${ctx.diff.sapAmount})`,
          actual: `结算单金额=${first.amount ?? "-"}`,
          result: equal ? "一致" : "不一致",
        };
      },
    },
    {
      id: "s3_check_sap_posting",
      desc: "核对 SAP 过账金额",
      tool: "sap.query_posting",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out, ctx) => {
        const posting = out as Record<string, unknown> | null;
        return Number(posting?.postingAmount) === ctx.diff.sapAmount;
      },
      ruleCode: "sap_posting_equals_sap_amount",
      evidence: (out, ctx) => {
        const posting = out as Record<string, unknown> | null;
        const equal = Number(posting?.postingAmount) === ctx.diff.sapAmount;
        return {
          sourceSystem: "SAP 过账数据",
          checkField: "收入过账金额",
          expected: `与差异表 SAP 金额一致 (${ctx.diff.sapAmount})`,
          actual: `SAP 过账金额=${posting?.postingAmount ?? "-"}`,
          result: equal ? "一致" : "不一致",
        };
      },
    },
    {
      id: "s4_detect_duplicate_ledger",
      desc: "检查 DMS 收入台账是否存在同结算单同金额重复记录",
      tool: "dms.query_revenue_ledger",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out) => {
        const rows = (out as Array<Record<string, unknown>>) ?? [];
        return rows.length > 1;
      },
      ruleCode: "ledger_duplicate_detected",
      evidence: (out) => {
        const rows = (out as Array<Record<string, unknown>>) ?? [];
        const dup = rows.length > 1;
        return {
          sourceSystem: "DMS 收入台账",
          checkField: "同单据同金额记录数",
          expected: "同一批次仅 1 条有效记录",
          actual: `共 ${rows.length} 条记录，批次相近时间`,
          result: dup ? "不一致" : "一致",
        };
      },
      onPass: { kind: "markRootCause", cause: "DMS_LEDGER_DUPLICATE_INSERT" },
      onFail: { kind: "continue" },
    },
  ],
  output: {
    rootCauseTemplate: (ctx) => {
      if (ctx.markers.rootCause === "DMS_LEDGER_DUPLICATE_INSERT") {
        return "DMS 结算单与 SAP 过账金额一致，异常发生在 DMS 收入台账写入环节，同结算单存在重复记录，导致帆软侧 DMS 收入金额约为 SAP 两倍。";
      }
      return "金额比例异常已识别，但暂未能在 DMS 收入台账中找到明确重复记录，建议补充批处理日志后再判定。";
    },
    firstAbnormalNode: () => "DMS 收入台账写入环节",
    confidence: (ctx) => {
      const hit = ctx.ruleHits.length;
      const base = Math.min(0.92, 0.5 + 0.12 * hit);
      return Math.round(base * 100);
    },
  },
  review: {
    required: true,
    routes: [
      { role: "DMS_OWNER", always: true },
      { role: "FINANCE_REVIEWER", always: true },
    ],
  },
  reportTemplateId: "tpl/amount_doubled_report.md",
  evalSetId: "eval/amount_doubled_v1.jsonl",
};
