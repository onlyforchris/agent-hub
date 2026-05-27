// Skill Hub：注册中心
// 对应方案 V3.0 第 6 章 Skill Hub

import { sameSettlementMultiMdmIdSkill } from "./same-settlement-multi-mdmid.js";
import { revenueAmountDoubledSkill } from "./revenue-amount-doubled.js";
import { sapDmsStatusMismatchSkill } from "./sap-dms-status-mismatch.js";
import type { SkillDefinition } from "../runtime/types.js";

const skills: Record<string, SkillDefinition> = {
  [sameSettlementMultiMdmIdSkill.code]: sameSettlementMultiMdmIdSkill,
  [revenueAmountDoubledSkill.code]: revenueAmountDoubledSkill,
  [sapDmsStatusMismatchSkill.code]: sapDmsStatusMismatchSkill,
};

export function getSkill(code: string): SkillDefinition {
  const s = skills[code];
  if (!s) throw new Error(`Skill not found: ${code}`);
  return s;
}

export function listSkills(): SkillDefinition[] {
  return Object.values(skills);
}
