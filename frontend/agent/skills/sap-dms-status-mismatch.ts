// Skill 3：SAP/DMS 状态回传异常归因
// 对应方案 V3.0 第 14.3 节

import type { SkillDefinition } from "../runtime/types.js";

export const sapDmsStatusMismatchSkill: SkillDefinition = {
  code: "sap_dms_status_mismatch",
  displayName: "SAP/DMS 状态回传异常归因 Skill",
  version: "1.0.0",
  owner: "中间件团队 / DMS 研发",
  applicableWhen: { diffType: "STATUS_MISMATCH", businessModule: "收入" },
  inputsDesc: [
    "帆软差异清单",
    "SAP ZTSD017 / 凭证",
    "DMS结算单状态",
    "SAP回传日志",
    "DMS接口接收日志",
  ],
  steps: [
    {
      id: "s1_query_sap_posting",
      desc: "查询 SAP 结算单状态：过账、开票、中止",
      tool: "sap.query_posting",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out) => Boolean(out),
      ruleCode: "sap_posting_found",
      evidence: (out) => {
        const s = out as Record<string, unknown> | null;
        return {
          sourceSystem: "SAP ZTSD017 / 凭证",
          checkField: "过账状态 / 开票状态",
          expected: "状态正常且可回传",
          actual: `过账=${s?.postingStatus ?? "-"}，开票=${s?.billingStatus ?? "-"}`,
          result: "一致",
        };
      },
    },
    {
      id: "s2_query_dms_settlement",
      desc: "查询 DMS 结算单状态",
      tool: "dms.query_settlement",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out) => Array.isArray(out) && out.length > 0,
      ruleCode: "dms_settlement_found",
      evidence: (out) => {
        const rows = (out as Array<Record<string, unknown>>) ?? [];
        const first = rows[0] ?? {};
        return {
          sourceSystem: "DMS 结算单",
          checkField: "结算单业务状态",
          expected: "与 SAP 状态同步",
          actual: `过账=${first.postingStatus ?? "-"}，开票=${first.billingStatus ?? "-"}`,
          result: "需复核",
        };
      },
    },
    {
      id: "s3_eval_status_matrix",
      desc: "比对双方状态矩阵",
      tool: "rule.eval_status_matrix",
      args: (ctx) => ({
        sap: ctx.stepResults["s1_query_sap_posting"],
        dms: (ctx.stepResults["s2_query_dms_settlement"] as Array<Record<string, unknown>>)?.[0] ?? {},
      }),
      rule: (out) => !(out as { mismatch: boolean }).mismatch,
      ruleCode: "status_matrix_consistent",
      evidence: (out) => {
        const r = out as { mismatch: boolean; sapPosted: boolean; dmsPosted: boolean };
        return {
          sourceSystem: "状态矩阵规则",
          checkField: "SAP/DMS 状态组合",
          expected: "SAP 已过账时 DMS 同步为已过账",
          actual: `SAP 已过账=${r.sapPosted}，DMS 已过账=${r.dmsPosted}`,
          result: r.mismatch ? "命中异常" : "一致",
        };
      },
      onFail: { kind: "markAbnormalNode", node: "DMS_STATUS_UPDATE" },
    },
    {
      id: "s4_query_interface_log",
      desc: "查询接口回传日志（发票回传 / 过账回传）",
      tool: "sap.query_interface_log",
      args: (ctx) => ({ settlementNo: ctx.diff.billNo }),
      rule: (out) => {
        const logs = (out as Array<Record<string, unknown>>) ?? [];
        if (logs.length === 0) return false;
        return logs.every((l) => l.returnStatus === "SUCCESS");
      },
      ruleCode: "interface_returned_success",
      evidence: (out) => {
        const logs = (out as Array<Record<string, unknown>>) ?? [];
        const allOk = logs.length > 0 && logs.every((l) => l.returnStatus === "SUCCESS");
        return {
          sourceSystem: "SAP 回传日志",
          checkField: "回传请求状态",
          expected: "请求发起且无失败返回",
          actual: logs.length === 0
            ? "无回传日志"
            : `共 ${logs.length} 条，全部返回 ${allOk ? "SUCCESS" : "存在失败"}`,
          result: allOk ? "一致" : "命中异常",
        };
      },
      onPass: { kind: "markRootCause", cause: "DMS_NOT_UPDATED_AFTER_RECEIVE" },
      onFail: { kind: "markRootCause", cause: "INTERFACE_CALLBACK_FAIL" },
    },
  ],
  output: {
    rootCauseTemplate: (ctx) => {
      if (ctx.markers.rootCause === "INTERFACE_CALLBACK_FAIL") {
        return "SAP 已过账且开票，但回传接口日志中存在失败记录，定位为接口回传失败。建议中间件负责人复核失败重试。";
      }
      if (ctx.markers.rootCause === "DMS_NOT_UPDATED_AFTER_RECEIVE") {
        return "SAP 已过账且开票，回传日志返回成功，但 DMS 结算单状态未更新，定位为 DMS 接收后处理或状态更新任务异常。";
      }
      return "状态差异已识别，根因尚不明确，需补充 DMS 接收后处理日志再定案。";
    },
    firstAbnormalNode: (ctx) => ctx.markers.abnormalNode ?? "DMS_STATUS_UPDATE",
    confidence: (ctx) => {
      const hit = ctx.ruleHits.length;
      const base = Math.min(0.9, 0.5 + 0.1 * hit);
      return Math.round(base * 100);
    },
  },
  review: {
    required: true,
    routes: [
      { role: "INTERFACE_OWNER", always: true },
      { role: "DMS_OWNER", whenAbnormalNode: "DMS_STATUS_UPDATE" },
      { role: "FINANCE_REVIEWER", always: true },
    ],
  },
  reportTemplateId: "tpl/status_mismatch_report.md",
  evalSetId: "eval/status_mismatch_v1.jsonl",
};
