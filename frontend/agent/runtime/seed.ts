// 启动期 Seed：在 traceStore 中预先跑几条 Run，让「Agent 执行追踪」页面默认有可演示的数据。
// 这些 Run 使用真实的 Planner / Executor / Model Gateway 路径，
// 与用户在工作台手动触发归因生成的 Run 完全同构。

import { dataQualityAgent } from "../agents/data-quality-agent.js";
import { connectors } from "../connectors";
import { runAgent } from "./runtime.js";
import { traceStore } from "./trace.js";
import type { DiffRecord } from "./types.js";

const SEED_DIFF_IDS = [
  "DIFF001",
  "DIFF002",
  "DIFF004",
  "DIFF005",
  "DIFF006",
  "DIFF009",
];

let seeded = false;

export async function seedTraceStore(): Promise<{ seeded: number; skipped: boolean }> {
  if (seeded || traceStore.list(1).length > 0) {
    return { seeded: 0, skipped: true };
  }
  seeded = true;

  const allDiffs = connectors.finereport.queryDiffList() as unknown as DiffRecord[];
  const target = SEED_DIFF_IDS
    .map((id) => allDiffs.find((d) => d.id === id))
    .filter((d): d is DiffRecord => Boolean(d));

  let count = 0;
  for (const diff of target) {
    try {
      await runAgent({
        agent: dataQualityAgent,
        diff,
        triggeredBy: "seed_demo",
      });
      count += 1;
    } catch (err) {
      console.warn(`[seed] runAgent failed for ${diff.id}:`, err);
    }
  }
  return { seeded: count, skipped: false };
}
