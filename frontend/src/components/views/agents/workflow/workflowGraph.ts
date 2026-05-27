import { MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  computeVerticalPipelineLayout,
  getPipelineEdgePatch,
  getVerticalGraphBounds,
} from "@/src/lib/workflowLayout.ts";
import type { WorkflowNodeData, WorkflowTone } from "./WorkflowNode.tsx";
import type { NodeKind } from "@/src/types/workflow.ts";
import { getPaletteItem } from "./shared/nodeRegistry.ts";

export type WorkflowStepDef = {
  id: string;
  title: string;
  type: NodeKind;
  icon: WorkflowNodeData["icon"];
  tone: WorkflowTone;
  desc: string;
  meta: string;
  stepIndex: number;
};

const REVENUE_STEPS: WorkflowStepDef[] = [
  "INPUT",
  "PROFILE",
  "TRANSFORM",
  "JOIN",
  "RULE",
  "MODEL",
  "REVIEW",
  "ACTION",
  "LEARN",
].map((kind, i) => {
  const p = getPaletteItem(kind as NodeKind);
  const ids = [
    "intake",
    "profile",
    "standard",
    "evidence",
    "rules",
    "report",
    "review",
    "writeback",
    "learn",
  ];
  return {
    id: ids[i],
    title: p.defaultTitle,
    type: kind as NodeKind,
    icon: p.icon,
    tone: p.tone,
    desc: p.defaultDesc,
    meta: p.defaultMeta,
    stepIndex: i + 1,
  };
});

const REVENUE_ORDER = REVENUE_STEPS.map((s) => s.id);
const REVENUE_SLOTS = computeVerticalPipelineLayout(REVENUE_ORDER);

const EXECUTION_EDGES = [
  ["intake", "profile"],
  ["profile", "standard"],
  ["standard", "evidence"],
  ["evidence", "rules"],
  ["rules", "report"],
  ["report", "review"],
  ["review", "writeback"],
  ["writeback", "learn"],
].map(([source, target], i) => ({
  id: `e-${source}-${target}`,
  source,
  target,
  index: i,
}));

export function getConnectedIds(nodeId: string): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>([nodeId]);
  const edges = new Set<string>();

  for (const edge of EXECUTION_EDGES) {
    if (edge.source === nodeId || edge.target === nodeId) {
      edges.add(edge.id);
      nodes.add(edge.source);
      nodes.add(edge.target);
    }
  }

  return { nodes, edges };
}

function buildNodes(steps: WorkflowStepDef[], activeId: string | null): Node<WorkflowNodeData>[] {
  const connected = activeId ? getConnectedIds(activeId) : null;

  return steps.map((step) => {
    const pos = REVENUE_SLOTS.get(step.id) ?? { x: 0, y: 0, row: 0 };
    const palette = getPaletteItem(step.type);
    return {
      id: step.id,
      type: "workflowStep",
      position: { x: pos.x, y: pos.y },
      data: {
        title: step.title,
        type: step.type,
        icon: step.icon,
        tone: step.tone,
        desc: step.desc,
        meta: step.meta,
        stepIndex: step.stepIndex,
        role: palette.role,
        group: palette.group,
        highlighted: connected ? step.id === activeId || connected.nodes.has(step.id) : false,
        dimmed: connected ? !connected.nodes.has(step.id) : false,
      },
      draggable: false,
      selectable: false,
      connectable: false,
    };
  });
}

function buildEdges(activeId: string | null): Edge[] {
  const connected = activeId ? getConnectedIds(activeId) : null;

  return EXECUTION_EDGES.map((def) => {
    const highlighted = connected?.edges.has(def.id) ?? false;
    const patch = getPipelineEdgePatch(REVENUE_ORDER, def.source, def.target);

    return {
      id: def.id,
      source: def.source,
      target: def.target,
      sourceHandle: patch.sourceHandle,
      targetHandle: patch.targetHandle,
      type: "workflowBezier",
      data: {
        highlighted,
        dimmed: connected ? !highlighted : false,
        route: patch.route,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: highlighted ? "#2563eb" : "#94a3b8",
        width: 16,
        height: 16,
      },
    };
  });
}

export function getWorkflowGraph(
  templateId: string,
  activeNodeId: string | null = null,
): {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  steps: WorkflowStepDef[];
  bounds: { width: number; height: number };
} {
  void templateId;
  const steps = REVENUE_STEPS;
  return {
    nodes: buildNodes(steps, activeNodeId),
    edges: buildEdges(activeNodeId),
    steps,
    bounds: getVerticalGraphBounds(REVENUE_ORDER),
  };
}

