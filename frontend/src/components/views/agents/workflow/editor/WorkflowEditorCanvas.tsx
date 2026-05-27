import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ConnectionLineType,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MarkerType } from "@xyflow/react";
import { workflowNodeTypes, type WorkflowNodeData } from "../WorkflowNode.tsx";
import { WorkflowBezierEdge } from "../WorkflowBezierEdge.tsx";
import {
  applySmartLayout,
  flowToGraph,
  graphToFlow,
  layoutFlowGraph,
  patchPipelineEdges,
} from "../shared/layoutDagre.ts";
import { getLinearExecutionOrder } from "@/src/lib/workflowLayout.ts";
import { getPaletteItem, newNodeId } from "../shared/nodeRegistry.ts";
import type { NodeKind, WorkflowGraph } from "@/src/types/workflow.ts";

const edgeTypes = { workflowBezier: WorkflowBezierEdge };

function graphSnapshotKey(graph: WorkflowGraph): string {
  return JSON.stringify({
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      x: n.position.x,
      y: n.position.y,
      title: n.data.title,
      desc: n.data.desc,
      meta: n.data.meta,
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    })),
  });
}

interface InnerProps {
  initialGraph: WorkflowGraph;
  onGraphChange: (graph: WorkflowGraph) => void;
  onSelectionChange: (node: Node<WorkflowNodeData> | null) => void;
  onAddNodeRef?: MutableRefObject<((kind: NodeKind) => void) | null>;
  onLayoutRef?: MutableRefObject<(() => void) | null>;
}

function EditorCanvasInner({
  initialGraph,
  onGraphChange,
  onSelectionChange,
  onAddNodeRef,
  onLayoutRef,
}: InnerProps) {
  const { fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerWidthRef = useRef(1200);
  const nodesRef = useRef<Node<WorkflowNodeData>[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const lastEmittedKeyRef = useRef("");

  const structureKey = useMemo(
    () =>
      `${initialGraph.nodes.map((n) => n.id).join(",")}|${initialGraph.edges.map((e) => `${e.source}>${e.target}`).join(",")}`,
    [initialGraph.nodes, initialGraph.edges],
  );

  const initial = useMemo(
    () => graphToFlow(initialGraph, containerWidthRef.current),
    [structureKey, initialGraph.viewport],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  nodesRef.current = nodes;
  edgesRef.current = edges;

  const fitCanvas = useCallback(() => {
    fitView({
      padding: { top: 48, right: 56, bottom: 48, left: 56 },
      maxZoom: 1.05,
      minZoom: 0.35,
    });
  }, [fitView]);

  useEffect(() => {
    const next = flowToGraph(nodes, edges, initialGraph.viewport);
    const key = graphSnapshotKey(next);
    if (key === lastEmittedKeyRef.current) return;
    lastEmittedKeyRef.current = key;
    onGraphChange(next);
  }, [nodes, edges, onGraphChange, initialGraph.viewport]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w < 200) return;
      const prev = containerWidthRef.current;
      containerWidthRef.current = w;
      if (Math.abs(w - prev) < 80) return;

      const nds = nodesRef.current;
      const eds = edgesRef.current;
      const order = getLinearExecutionOrder(
        nds.map((n) => n.id),
        eds.map((e) => ({ source: e.source, target: e.target })),
      );
      if (order.length !== nds.length) return;

      const laid = applySmartLayout(nds, eds, w);
      const nextEdges = patchPipelineEdges(eds, order);
      setNodes(laid);
      setEdges(nextEdges);
      window.setTimeout(fitCanvas, 60);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [setNodes, setEdges, fitCanvas]);

  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
    lastEmittedKeyRef.current = graphSnapshotKey(
      flowToGraph(
        initial.nodes as Node<WorkflowNodeData>[],
        initial.edges,
        initialGraph.viewport,
      ),
    );
    const t = window.setTimeout(fitCanvas, 100);
    return () => window.clearTimeout(t);
  }, [structureKey, initial.nodes, initial.edges, initialGraph.viewport, setNodes, setEdges, fitCanvas]);

  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((eds) => {
        const raw = addEdge(
          {
            ...conn,
            id: `e-${conn.source}-${conn.target}-${Date.now()}`,
            type: "workflowBezier",
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 16, height: 16 },
            data: { route: "flow" },
          },
          eds,
        );
        const order = getLinearExecutionOrder(
          nodesRef.current.map((n) => n.id),
          raw.map((e) => ({ source: e.source, target: e.target })),
        );
        return patchPipelineEdges(raw, order);
      });
    },
    [setEdges],
  );

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        const g = initialGraph.nodes.find((x) => x.id === n.id);
        if (!g) return n;
        return {
          ...n,
          data: {
            ...n.data,
            title: g.data.title,
            desc: g.data.desc,
            meta: g.data.meta,
          },
        };
      }),
    );
  }, [initialGraph.nodes, setNodes]);

  const addNode = useCallback(
    (kind: NodeKind) => {
      const p = getPaletteItem(kind);
      const id = newNodeId(kind);
      const newNode: Node<WorkflowNodeData> = {
        id,
        type: "workflowStep",
        position: { x: 120, y: 120 },
        data: {
          title: p.defaultTitle,
          type: kind,
          icon: p.icon,
          tone: p.tone,
          desc: p.defaultDesc,
          meta: p.defaultMeta,
          stepIndex: nodesRef.current.length + 1,
          role: p.role,
          group: p.group,
          readOnly: false,
        },
      };
      const next = [...nodesRef.current, newNode];
      const { nodes: laid, edges: nextEdges } = layoutFlowGraph(
        next,
        edgesRef.current,
        containerWidthRef.current,
      );
      setNodes(laid);
      setEdges(nextEdges);
      window.setTimeout(fitCanvas, 50);
    },
    [setNodes, setEdges, fitCanvas],
  );

  const runLayout = useCallback(() => {
    const w = containerWidthRef.current;
    const nds = nodesRef.current;
    const eds = edgesRef.current;
    const order = getLinearExecutionOrder(
      nds.map((n) => n.id),
      eds.map((e) => ({ source: e.source, target: e.target })),
    );
    const laid = applySmartLayout(nds, eds, w);
    const nextEdges = patchPipelineEdges(eds, order);
    setNodes(laid);
    setEdges(nextEdges);
    window.setTimeout(fitCanvas, 50);
  }, [setNodes, setEdges, fitCanvas]);

  useEffect(() => {
    if (onAddNodeRef) onAddNodeRef.current = addNode;
  }, [onAddNodeRef, addNode]);

  useEffect(() => {
    if (onLayoutRef) onLayoutRef.current = runLayout;
  }, [onLayoutRef, runLayout]);

  return (
    <div
      ref={canvasRef}
      className="workflow-studio-canvas workflow-editor-canvas relative h-full min-h-0 flex-1 bg-[#f4f6f9]"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={workflowNodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: "workflowBezier",
          data: { route: "flow" },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8", width: 16, height: 16 },
        }}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: "#94a3b8", strokeWidth: 1.75 }}
        onSelectionChange={({ nodes: sel }) => onSelectionChange(sel[0] as Node<WorkflowNodeData> | null)}
        minZoom={0.25}
        maxZoom={1.4}
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={["Backspace", "Delete"]}
        className="workflow-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dde3ea" />
        <Controls showInteractive={false} className="!shadow-md" />
        <MiniMap
          nodeStrokeWidth={2}
          zoomable
          pannable
          className="!rounded-lg !border !border-slate-200 !shadow-md"
        />
      </ReactFlow>
    </div>
  );
}

interface Props extends InnerProps {}

export function WorkflowEditorCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

