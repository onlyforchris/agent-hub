/** 与 WorkflowNode 画布尺寸一致 */
export const WORKFLOW_LAYOUT = {
  nodeWidth: 280,
  nodeHeight: 108,
  gapX: 48,
  rowGap: 72,
  paddingX: 48,
  paddingY: 48,
} as const;

export type LayoutSlot = { x: number; y: number; row: number };

/** 按执行顺序提取线性链 */
export function getLinearExecutionOrder(
  nodeIds: string[],
  edges: { source: string; target: string }[],
): string[] {
  if (nodeIds.length === 0) return [];
  const idSet = new Set(nodeIds);
  const outgoing = new Map<string, string[]>();
  const indeg = new Map<string, number>();

  for (const id of nodeIds) {
    outgoing.set(id, []);
    indeg.set(id, 0);
  }
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    outgoing.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  const starts = nodeIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  const order: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = starts[0] ?? nodeIds[0];

  while (cur && !seen.has(cur)) {
    seen.add(cur);
    order.push(cur);
    const next = (outgoing.get(cur) ?? []).filter((t) => !seen.has(t));
    cur = next[0];
  }

  for (const id of nodeIds) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

/** 纵向主流程（Dify 风格）：自上而下，连线为垂向贝塞尔曲线 */
export function computeVerticalPipelineLayout(
  order: string[],
  containerWidth?: number,
): Map<string, LayoutSlot> {
  const { nodeWidth, rowGap, paddingX, paddingY, nodeHeight } = WORKFLOW_LAYOUT;
  const canvasW = containerWidth ?? paddingX * 2 + nodeWidth;
  const centerX = Math.max(paddingX, (canvasW - nodeWidth) / 2);
  const positions = new Map<string, LayoutSlot>();

  order.forEach((id, index) => {
    positions.set(id, {
      x: centerX,
      y: paddingY + index * (nodeHeight + rowGap),
      row: index,
    });
  });

  return positions;
}

export function getVerticalGraphBounds(
  order: string[],
  containerWidth?: number,
): { width: number; height: number } {
  const { nodeWidth, rowGap, paddingX, paddingY, nodeHeight } = WORKFLOW_LAYOUT;
  const w = containerWidth ?? paddingX * 2 + nodeWidth;
  const h = paddingY * 2 + order.length * nodeHeight + Math.max(0, order.length - 1) * rowGap;
  return { width: w, height: h };
}

export type PipelineEdgePatch = {
  sourceHandle: string;
  targetHandle: string;
  route: "flow" | "branch";
};

/** 相邻节点：垂直连线；其余回退为侧向 */
export function getPipelineEdgePatch(
  order: string[],
  source: string,
  target: string,
): PipelineEdgePatch {
  const si = order.indexOf(source);
  const ti = order.indexOf(target);
  if (si < 0 || ti < 0) {
    return { sourceHandle: "out-bottom", targetHandle: "in-top", route: "flow" };
  }
  if (ti === si + 1) {
    return { sourceHandle: "out-bottom", targetHandle: "in-top", route: "flow" };
  }
  return { sourceHandle: "out", targetHandle: "in", route: "branch" };
}
