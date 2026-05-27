// Skill Executor：按 Skill DSL 顺序执行步骤
// 对应方案 V3.0 第 5 章 Run 生命周期 + 第 6 章 Skill 结构

import { getTool } from "../tools/registry.js";
import { traceStore } from "./trace.js";
import type {
  DiffRecord,
  RunStep,
  SkillDefinition,
  SkillRunCtx,
  StepType,
} from "./types.js";

function nowISO(): string {
  return new Date().toISOString();
}

function tsNow(): number {
  return Date.now();
}

export async function executeSkill(
  runId: string,
  agentCode: string,
  skill: SkillDefinition,
  diff: DiffRecord,
): Promise<SkillRunCtx> {
  const ctx: SkillRunCtx = {
    runId,
    diff,
    stepResults: {},
    markers: {},
    ruleHits: [],
    evidence: [],
  };

  let seq = traceStore.get(runId)?.steps.length ?? 0;

  for (const step of skill.steps) {
    if (ctx.markers.stopped) break;
    seq += 1;

    const startedAt = tsNow();
    let toolOutput: unknown = undefined;
    let stepType: StepType = "tool_call";
    let toolInput: Record<string, unknown> | undefined = undefined;

    try {
      if (step.tool) {
        const tool = getTool(step.tool);
        toolInput = step.args ? step.args(ctx) : {};
        toolOutput = await tool.invoke(toolInput, {
          runId,
          agentCode,
          skillCode: skill.code,
          stepId: step.id,
        });
        ctx.stepResults[step.id] = toolOutput;
        stepType = tool.category === "rule" ? "rule" : "tool_call";
      } else {
        stepType = "rule";
      }

      // 规则判断
      let passed: boolean | undefined = undefined;
      if (step.rule) {
        passed = step.rule(toolOutput, ctx);
        if (passed && step.ruleCode) ctx.ruleHits.push(step.ruleCode);
      }

      // 证据落库（自动）
      if (step.evidence) {
        const ev = step.evidence(toolOutput, ctx);
        ctx.evidence.push(ev);
      }

      // 分支动作
      const branch = passed === false ? step.onFail : step.onPass;
      if (branch) {
        switch (branch.kind) {
          case "stop":
            ctx.markers.stopped = true;
            break;
          case "conclude":
            ctx.markers.conclusion = branch.conclusion;
            break;
          case "markAbnormalNode":
            ctx.markers.abnormalNode = branch.node;
            break;
          case "markRootCause":
            ctx.markers.rootCause = branch.cause;
            break;
          case "continue":
          default:
            break;
        }
      }

      const runStep: RunStep = {
        seq,
        stepId: step.id,
        stepType,
        desc: step.desc,
        toolName: step.tool,
        input: toolInput,
        output: toolOutput,
        ruleHit: passed && step.ruleCode ? step.ruleCode : undefined,
        passed,
        durationMs: tsNow() - startedAt,
        createdAt: nowISO(),
      };
      traceStore.appendStep(runId, runStep);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const runStep: RunStep = {
        seq,
        stepId: step.id,
        stepType,
        desc: step.desc,
        toolName: step.tool,
        input: toolInput,
        output: { error: message },
        passed: false,
        durationMs: tsNow() - startedAt,
        createdAt: nowISO(),
      };
      traceStore.appendStep(runId, runStep);
      ctx.markers.stopped = true;
      ctx.markers.conclusion = `Step ${step.id} 执行失败：${message}`;
      break;
    }
  }

  return ctx;
}
