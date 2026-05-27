// 场景 Agent：对账治理 Agent
// 对应方案 V3.0 第 13 章

import type { AgentDefinition } from "../runtime/types.js";

export const dataQualityAgent: AgentDefinition = {
  code: "data_quality_agent",
  displayName: "对账治理 Agent",
  domain: "财务对账差异归因",
  executionMode: "workflow",
  workflowTemplateId: "revenue_quality",
  defaultSkills: [
    "same_settlement_multiple_mdmid",
    "revenue_amount_doubled",
    "sap_dms_status_mismatch",
  ],
  planner: {
    type: "rule_then_model",
    rules: [
      { whenDiffType: "MDM_ID_ANOMALY", useSkill: "same_settlement_multiple_mdmid" },
      { whenDiffType: "AMOUNT_DOUBLE", useSkill: "revenue_amount_doubled" },
      { whenDiffType: "STATUS_MISMATCH", useSkill: "sap_dms_status_mismatch" },
    ],
  },
};
