// 一期 Trace Store：进程内存储，体现 Run/Step 数据模型。
// 正式版应替换为 PostgreSQL 持久化（参见 V3.0 第 5.3 节）。

import type { AgentRun, RunStep } from "./types.js";

class InMemoryTraceStore {
  private runs = new Map<string, AgentRun>();
  private order: string[] = [];

  create(run: AgentRun): void {
    this.runs.set(run.id, run);
    this.order.unshift(run.id);
    if (this.order.length > 200) {
      const dropId = this.order.pop();
      if (dropId) this.runs.delete(dropId);
    }
  }

  update(runId: string, patch: Partial<AgentRun>): void {
    const run = this.runs.get(runId);
    if (!run) return;
    Object.assign(run, patch);
  }

  appendStep(runId: string, step: RunStep): void {
    const run = this.runs.get(runId);
    if (!run) return;
    run.steps.push(step);
  }

  get(runId: string): AgentRun | undefined {
    return this.runs.get(runId);
  }

  list(limit = 50): AgentRun[] {
    return this.order
      .slice(0, limit)
      .map((id) => this.runs.get(id))
      .filter((r): r is AgentRun => Boolean(r));
  }
}

export const traceStore = new InMemoryTraceStore();
