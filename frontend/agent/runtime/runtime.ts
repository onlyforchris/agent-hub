// Agent Runtime：场景 Agent 与中台之间的入口
// 对应方案 V3.0 第 4 章中台总览 + 第 5 章 Runtime 生命周期

import { getSkill } from "../skills/registry.js";
import { runModelGateway } from "../model/gateway.js";
import { selectSkill } from "./planner.js";
import { executeSkill } from "./executor.js";
import { traceStore } from "./trace.js";
import type {
  AgentDefinition,
  AgentRun,
  DiffRecord,
  RunStep,
} from "./types.js";

function nowISO(): string {
  return new Date().toISOString();
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface RuntimeInput {
  agent: AgentDefinition;
  diff: DiffRecord;
  triggeredBy: string;
}

export interface RuntimeOutput {
  run: AgentRun;
}

export async function runAgent({ agent, diff, triggeredBy }: RuntimeInput): Promise<RuntimeOutput> {
  const runId = generateRunId();
  const startedAt = Date.now();

  const run: AgentRun = {
    id: runId,
    agentCode: agent.code,
    triggeredBy,
    diffId: diff.id,
    billNo: diff.billNo,
    status: "RUNNING",
    createdAt: nowISO(),
    steps: [],
  };
  traceStore.create(run);

  // Step 1: Plan（Skill 选择）
  const planStart = Date.now();
  const plan = selectSkill(diff, agent.planner);
  const planStep: RunStep = {
    seq: 1,
    stepId: "plan",
    stepType: "plan",
    desc: `Planner 路由：${plan.reason}`,
    input: { diffType: diff.type, billNo: diff.billNo },
    output: { skillCode: plan.skillCode, matchedRule: plan.matchedRule },
    passed: true,
    durationMs: Date.now() - planStart,
    createdAt: nowISO(),
  };
  traceStore.appendStep(runId, planStep);
  traceStore.update(runId, { skillCode: plan.skillCode });

  // Step 2..N: Skill 步骤执行
  const skill = getSkill(plan.skillCode);
  const ctx = await executeSkill(runId, agent.code, skill, diff);

  // Step N+1: Model Gateway 渲染报告
  const modelStart = Date.now();
  const modelOut = await runModelGateway({
    runId,
    agentCode: agent.code,
    skillCode: skill.code,
    desensitizedSummary: {
      diff_type: diff.type,
      first_abnormal_node: skill.output.firstAbnormalNode(ctx),
      root_cause: skill.output.rootCauseTemplate(ctx),
      rule_hits: ctx.ruleHits,
      evidence_count: ctx.evidence.length,
    },
    evidence: ctx.evidence,
    reviewSuggestionSeed: {
      reviewRoutes: skill.review.routes.map((r) => r.role),
    },
  });
  const modelStep: RunStep = {
    seq: (traceStore.get(runId)?.steps.length ?? 0) + 1,
    stepId: "model_report",
    stepType: "model",
    desc: "Model Gateway 生成归因报告（脱敏后）",
    input: modelOut.gatewayDebug.payloadToModel,
    output: { reportText: modelOut.reportText, mode: modelOut.mode },
    passed: true,
    durationMs: Date.now() - modelStart,
    createdAt: nowISO(),
  };
  traceStore.appendStep(runId, modelStep);

  // Step N+2: Review route 落库
  const reviewRoutes = skill.review.routes
    .filter((r) => r.always || (r.whenAbnormalNode && r.whenAbnormalNode === ctx.markers.abnormalNode))
    .map((r) => r.role);
  const reviewStep: RunStep = {
    seq: (traceStore.get(runId)?.steps.length ?? 0) + 1,
    stepId: "review_route",
    stepType: "review_route",
    desc: "按 Skill 复核规则路由到对应岗位",
    input: { abnormalNode: ctx.markers.abnormalNode },
    output: { reviewRoutes },
    passed: true,
    durationMs: 1,
    createdAt: nowISO(),
  };
  traceStore.appendStep(runId, reviewStep);

  const finishedAt = Date.now();
  const confidence = skill.output.confidence(ctx);
  const rootCause = ctx.markers.conclusion ?? skill.output.rootCauseTemplate(ctx);
  const firstAbnormalNode = skill.output.firstAbnormalNode(ctx);

  traceStore.update(runId, {
    status: skill.review.required ? "NEEDS_REVIEW" : "SUCCESS",
    confidence,
    rootCause,
    firstAbnormalNode,
    evidence: ctx.evidence,
    reviewRoutes,
    reportText: modelOut.reportText,
    durationMs: finishedAt - startedAt,
    finishedAt: nowISO(),
  });

  return { run: traceStore.get(runId)! };
}
