import type { DagValidationIssue, DagValidationResult, WorkflowGraph } from "@/src/types/workflow.ts";

export function validateDag(graph: WorkflowGraph): DagValidationResult {
  const errors: DagValidationIssue[] = [];
  const warnings: DagValidationIssue[] = [];
  const { nodes, edges } = graph;

  if (nodes.length === 0) {
    errors.push({ level: "error", code: "EMPTY_GRAPH", message: "工作流至少需要一个节点" });
    return { valid: false, errors, warnings };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  const edgeKeys = new Set<string>();
  for (const e of edges) {
    if (e.source === e.target) {
      errors.push({
        level: "error",
        code: "SELF_LOOP",
        message: "不允许自连接",
        edgeId: e.id,
        nodeId: e.source,
      });
      continue;
    }
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      errors.push({
        level: "error",
        code: "DANGLING_EDGE",
        message: "连线引用了不存在的节点",
        edgeId: e.id,
      });
      continue;
    }
    const key = `${e.source}->${e.target}`;
    if (edgeKeys.has(key)) {
      errors.push({
        level: "error",
        code: "DUPLICATE_EDGE",
        message: "重复连线",
        edgeId: e.id,
      });
    }
    edgeKeys.add(key);
    adj.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    outDegree.set(e.source, (outDegree.get(e.source) ?? 0) + 1);
  }

  const inputNodes = nodes.filter((n) => n.kind === "INPUT");
  if (inputNodes.length === 0) {
    warnings.push({ level: "warning", code: "NO_INPUT", message: "建议至少包含一个「差异发现」入口节点" });
  } else if (inputNodes.length > 1) {
    warnings.push({
      level: "warning",
      code: "MULTI_INPUT",
      message: "存在多个入口节点，请确认是否符合业务设计",
    });
  }

  const sorted = topologicalSort(nodes.map((n) => n.id), adj);
  if (sorted === null) {
    errors.push({ level: "error", code: "CYCLE", message: "存在环路，不符合 DAG" });
  }

  for (const n of nodes) {
    const inn = inDegree.get(n.id) ?? 0;
    const out = outDegree.get(n.id) ?? 0;
    if (inn === 0 && out === 0 && nodes.length > 1) {
      errors.push({
        level: "error",
        code: "ISOLATED",
        message: "节点未接入主路径",
        nodeId: n.id,
      });
    }
  }

  const terminals = nodes.filter((n) => (outDegree.get(n.id) ?? 0) === 0);
  if (terminals.length === 0 && nodes.length > 0) {
    warnings.push({ level: "warning", code: "NO_TERMINAL", message: "建议设置无出边的终点节点（如规则沉淀）" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

function topologicalSort(nodeIds: string[], adj: Map<string, string[]>): string[] | null {
  const inDeg = new Map<string, number>();
  for (const id of nodeIds) inDeg.set(id, 0);
  for (const [, targets] of adj) {
    for (const t of targets) {
      inDeg.set(t, (inDeg.get(t) ?? 0) + 1);
    }
  }
  const queue = nodeIds.filter((id) => (inDeg.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);
    for (const v of adj.get(u) ?? []) {
      const d = (inDeg.get(v) ?? 0) - 1;
      inDeg.set(v, d);
      if (d === 0) queue.push(v);
    }
  }
  return order.length === nodeIds.length ? order : null;
}

