// Agent Runtime 核心类型定义
// 这层抽象等价于方案 V3.0 第 5 章 Agent Runtime 与第 6 章 Skill DSL

export type EvidenceResult = "一致" | "不一致" | "命中异常" | "需复核";

export interface EvidenceItem {
  sourceSystem: string;
  checkField: string;
  expected: string;
  actual: string;
  result: EvidenceResult;
}

export interface ToolDefinition {
  name: string;
  version: string;
  category: "data_query" | "rule" | "template" | "notify" | "compute";
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  dataSensitivity: "public" | "internal" | "internal_finance" | "restricted";
  sideEffect: "none" | "notify" | "write";
  connector: string;
  owner: string;
  allowedAgents?: string[];
  allowedRoles?: string[];
  invoke: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  runId: string;
  agentCode: string;
  skillCode: string;
  stepId: string;
}

export type SkillStepOnResult =
  | { kind: "continue" }
  | { kind: "stop" }
  | { kind: "conclude"; conclusion: string }
  | { kind: "markAbnormalNode"; node: string }
  | { kind: "markRootCause"; cause: string };

export interface SkillStep {
  id: string;
  desc: string;
  tool?: string;
  args?: (ctx: SkillRunCtx) => Record<string, unknown>;
  rule?: (result: unknown, ctx: SkillRunCtx) => boolean;
  ruleCode?: string;
  evidence?: (result: unknown, ctx: SkillRunCtx) => EvidenceItem;
  onPass?: SkillStepOnResult;
  onFail?: SkillStepOnResult;
}

export interface SkillDefinition {
  code: string;
  displayName: string;
  version: string;
  owner: string;
  applicableWhen: { diffType: string; businessModule: string };
  inputsDesc: string[];
  steps: SkillStep[];
  output: {
    rootCauseTemplate: (ctx: SkillRunCtx) => string;
    firstAbnormalNode: (ctx: SkillRunCtx) => string;
    confidence: (ctx: SkillRunCtx) => number;
  };
  review: {
    required: boolean;
    routes: { role: string; whenAbnormalNode?: string; always?: boolean }[];
  };
  reportTemplateId: string;
  evalSetId: string;
}

export interface DiffRecord {
  id: string;
  billNo: string;
  type: "MDM_ID_ANOMALY" | "AMOUNT_DOUBLE" | "STATUS_MISMATCH";
  module: string;
  sapAmount: number;
  dmsAmount: number;
  diffAmount: number;
  businessLine: string;
  sourceSystem: string;
  targetSystem: string;
  ownerSystem: string;
  createdAtLabel?: string;
  status?: string;
  desc?: string;
}

export interface SkillRunCtx {
  runId: string;
  diff: DiffRecord;
  stepResults: Record<string, unknown>;
  markers: {
    abnormalNode?: string;
    rootCause?: string;
    conclusion?: string;
    stopped?: boolean;
  };
  ruleHits: string[];
  evidence: EvidenceItem[];
}

export type StepType = "plan" | "tool_call" | "rule" | "model" | "human" | "review_route";

export interface RunStep {
  seq: number;
  stepId: string;
  stepType: StepType;
  desc: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  ruleHit?: string;
  passed?: boolean;
  durationMs: number;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  agentCode: string;
  skillCode?: string;
  triggeredBy: string;
  diffId: string;
  billNo: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "NEEDS_REVIEW";
  confidence?: number;
  rootCause?: string;
  firstAbnormalNode?: string;
  evidence?: EvidenceItem[];
  reviewRoutes?: string[];
  reportText?: string;
  durationMs?: number;
  createdAt: string;
  finishedAt?: string;
  steps: RunStep[];
}

export interface AgentDefinition {
  code: string;
  displayName: string;
  domain: string;
  executionMode: "workflow" | "plan_execute" | "react";
  /** 工作流编排模式下绑定的已发布 Workflow 模板 ID */
  workflowTemplateId?: string;
  defaultSkills: string[];
  planner: PlannerConfig;
}

export interface PlannerConfig {
  type: "rule_then_model";
  rules: { whenDiffType: string; useSkill: string }[];
  fallbackSkill?: string;
}
