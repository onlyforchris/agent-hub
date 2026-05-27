// Planner：把差异路由到对应 Skill。
// 一期：规则优先；规则不命中再交给模型兜底（POC 中只演示规则路径）。

import type { DiffRecord, PlannerConfig } from "./types.js";

export interface PlannerOutput {
  skillCode: string;
  reason: string;
  matchedRule?: string;
}

export function selectSkill(diff: DiffRecord, config: PlannerConfig): PlannerOutput {
  for (const rule of config.rules) {
    if (rule.whenDiffType === diff.type) {
      return {
        skillCode: rule.useSkill,
        reason: `规则路由：diff.type=${diff.type} → ${rule.useSkill}`,
        matchedRule: `when diff_type == ${diff.type}`,
      };
    }
  }
  if (config.fallbackSkill) {
    return {
      skillCode: config.fallbackSkill,
      reason: "未命中规则，使用 fallback Skill（演示）",
    };
  }
  throw new Error(`Planner: 未找到匹配 Skill, diff.type=${diff.type}`);
}
