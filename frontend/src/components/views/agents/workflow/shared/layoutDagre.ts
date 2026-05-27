import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { WorkflowGraph } from "@/src/types/workflow.ts";
import {
  WORKFLOW_LAYOUT,
  computeVerticalPipelineLayout,
  getLinearExecutionOrder,
  getPipelineEdgePatch,
  getVerticalGraphBounds,
} from "@/src/lib/workflowLayout.ts";
import { getPaletteItem } from "./nodeRegistry.ts";
import type { WorkflowNodeData } from "../WorkflowNode.tsx";

const NODE_W = WORKFLOW_LAYOUT.nodeWidth;
const NODE_H = WORKFLOW_LAYOUT.nodeHeight;

export function applyDagreLayout(nodes: Node<WorkflowNodeData>[], edges: Edge[]): Node<WorkflowNodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 64, ranksep: 72, marginx: 48, marginy: 48 });

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: { ...n.data },
    };
  });
}

export function patchPipelineEdges(edges: Edge[], order: string[]): Edge[] {
  return edges.map((e) => {
    const patch = getPipelineEdgePatch(order, e.source, e.target);
    return {
      ...e,
      type: "workflowBezier",
      sourceHandle: patch.sourceHandle,
      targetHandle: patch.targetHandle,
      data: { ...(e.data as object), route: patch.route },
    };
  });
}

export function applyPipelineLayout(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  containerWidth?: number,
): Node<WorkflowNodeData>[] {
  const order = getLinearExecutionOrder(
    nodes.map((n) => n.id),
    edges.map((e) => ({ source: e.source, target: e.target })),
  );
  const slots = computeVerticalPipelineLayout(order, containerWidth);

  return nodes.map((n) => {
    const slot = slots.get(n.id);
    const stepIndex = order.indexOf(n.id) + 1;
    const palette = getPaletteItem(n.data.type);
    return {
      ...n,
      position: { x: slot?.x ?? n.position.x, y: slot?.y ?? n.position.y },
      data: {
        ...n.data,
        stepIndex: stepIndex > 0 ? stepIndex : n.data.stepIndex,
        role: palette.role,
        group: palette.group,
      },
    };
  });
}

export function applySmartLayout(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  containerWidth?: number,
): Node<WorkflowNodeData>[] {
  const order = getLinearExecutionOrder(
    nodes.map((n) => n.id),
    edges.map((e) => ({ source: e.source, target: e.target })),
  );
  const branchy = edges.length > Math.max(0, nodes.length - 1);
  if (!branchy && order.length === nodes.length) {
    return applyPipelineLayout(nodes, edges, containerWidth);
  }
  return applyDagreLayout(nodes, edges);
}

export function layoutFlowGraph(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  containerWidth?: number,
) {
  if (nodes.length < 2) {
    return {
      nodes,
      edges,
      bounds: getVerticalGraphBounds(nodes.map((n) => n.id), containerWidth),
    };
  }
  const order = getLinearExecutionOrder(
    nodes.map((n) => n.id),
    edges.map((e) => ({ source: e.source, target: e.target })),
  );
  const branchy = edges.length > Math.max(0, nodes.length - 1);
  const usePipeline = !branchy && order.length === nodes.length;
  const laid = usePipeline
    ? applyPipelineLayout(nodes, edges, containerWidth)
    : applyDagreLayout(nodes, edges);
  const patched = usePipeline ? patchPipelineEdges(edges, order) : edges;
  const bounds = getVerticalGraphBounds(order, containerWidth);
  return { nodes: laid, edges: patched, bounds };
}

export function graphToFlow(
  graph: WorkflowGraph,
  containerWidth?: number,
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  const nodes: Node<WorkflowNodeData>[] = graph.nodes.map((n, i) => {
    const p = getPaletteItem(n.kind);
    return {
      id: n.id,
      type: "workflowStep",
      position: n.position,
      data: {
        title: n.data.title,
        type: n.kind,
        icon: p.icon,
        tone: p.tone,
        desc: n.data.desc,
        meta: n.data.meta,
        stepIndex: i + 1,
        role: p.role,
        group: p.group,
        readOnly: false,
      },
      draggable: true,
      connectable: true,
    };
  });

  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: "out-bottom",
    targetHandle: "in-top",
    type: "workflowBezier",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 16, height: 16 },
    data: { route: "flow" },
  }));

  const { nodes: laid, edges: patched } = layoutFlowGraph(nodes, edges, containerWidth);
  return { nodes: laid, edges: patched };
}

export function flowToGraph(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  viewport?: WorkflowGraph["viewport"],
): WorkflowGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.data.type,
      position: n.position,
      data: {
        title: n.data.title,
        desc: n.data.desc,
        meta: n.data.meta,
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })),
    viewport,
  };
}

