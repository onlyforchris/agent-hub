import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutGrid, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { workflowApi } from "@/src/lib/workflowApi.ts";
import { resolveWorkflowPublishedGraph } from "@/src/lib/workflowCatalog.ts";
import type { WorkflowGraph } from "@/src/types/workflow.ts";
import { graphToFlow } from "./shared/layoutDagre.ts";
import { getVerticalGraphBounds } from "@/src/lib/workflowLayout.ts";
import { getWorkflowGraph } from "./workflowGraph.ts";
import { workflowNodeTypes, type WorkflowNodeData } from "./WorkflowNode.tsx";
import { WorkflowBezierEdge } from "./WorkflowBezierEdge.tsx";
import { getPaletteItem } from "./shared/nodeRegistry.ts";

interface Props {
  templateId: string;
  templateName?: string;
  templateVersion?: string;
}

const edgeTypes = {
  workflowBezier: WorkflowBezierEdge,
};

function CanvasControls() {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow();
  const [zoom, setZoom] = useState(100);

  const syncZoom = useCallback(() => {
    requestAnimationFrame(() => setZoom(Math.round(getZoom() * 100)));
  }, [getZoom]);

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200/90 bg-white/95 p-0.5 shadow-md backdrop-blur-sm">
      <button
        type="button"
        title="缩小"
        onClick={() => {
          zoomOut({ duration: 180 });
          syncZoom();
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[40px] text-center font-mono text-[10px] font-semibold text-slate-500">
        {zoom}%
      </span>
      <button
        type="button"
        title="放大"
        onClick={() => {
          zoomIn({ duration: 180 });
          syncZoom();
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-slate-200" />
      <button
        type="button"
        title="适应画布"
        onClick={() => {
          fitView({
            padding: { top: 56, right: 48, bottom: 48, left: 48 },
            duration: 350,
          });
          syncZoom();
        }}
        className="flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
      >
        <Maximize2 className="h-3 w-3" />
        适应
      </button>
    </div>
  );
}

function WorkflowCanvasInner({
  templateId,
  templateName = "收入回款对账治理",
  templateVersion = "v1.0",
}: Props) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [apiGraph, setApiGraph] = useState<WorkflowGraph | null>(null);
  const { fitView } = useReactFlow();

  useEffect(() => {
    let cancelled = false;
    void workflowApi
      .publishedGraph(templateId)
      .then((g) => {
        if (!cancelled) setApiGraph(g);
      })
      .catch(() => {
        if (!cancelled) setApiGraph(resolveWorkflowPublishedGraph(templateId));
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const { nodes, edges, steps, bounds } = useMemo(() => {
    if (apiGraph) {
      const flow = graphToFlow(apiGraph);
      const flowNodes = flow.nodes.map((n) => ({
        ...n,
        draggable: false,
        selectable: false,
        connectable: false,
        data: { ...n.data, readOnly: true },
      }));
      const bounds = getVerticalGraphBounds(flowNodes.map((n) => n.id));
      return {
        nodes: flowNodes,
        edges: flow.edges,
        steps: flowNodes.map((n) => ({
          id: n.id,
          title: n.data.title,
          type: n.data.type,
          desc: n.data.desc,
          meta: n.data.meta,
        })),
        bounds,
      };
    }
    return getWorkflowGraph(templateId, activeNodeId);
  }, [apiGraph, templateId, activeNodeId]);

  const activeStep = steps.find((s) => s.id === activeNodeId);

  useEffect(() => {
    const t = window.setTimeout(() => {
      fitView({
        padding: { top: 56, right: 48, bottom: 48, left: 48 },
        duration: 400,
      });
    }, 100);
    return () => window.clearTimeout(t);
  }, [fitView, templateId, bounds.width]);

  const onNodeEnter = useCallback((_: MouseEvent, node: Node<WorkflowNodeData>) => {
    setActiveNodeId(node.id);
  }, []);

  const onNodeLeave = useCallback(() => {
    setActiveNodeId(null);
  }, []);

  return (
    <div
      className="workflow-studio-canvas relative w-full overflow-hidden rounded-xl border border-slate-200 bg-[#f8fafc]"
      style={{ height: 540, minWidth: Math.min(bounds.width + 24, 1280) }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={workflowNodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.35}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        onNodeMouseEnter={onNodeEnter}
        onNodeMouseLeave={onNodeLeave}
        className="workflow-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />

        <Panel position="top-left" className="!m-3 !pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
              <LayoutGrid className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[13px] font-semibold leading-tight text-slate-900">
                {templateName}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="font-mono font-medium text-slate-600">{templateVersion}</span>
                <span className="text-slate-300">|</span>
                <span>执行 DAG</span>
                <span className="text-slate-300">|</span>
                <span>只读预览</span>
              </div>
            </div>
          </div>
        </Panel>

        {activeStep && (
          <Panel position="top-right" className="!m-3">
            <div className="max-w-[240px] rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-sm">
              <div className="text-[12px] font-semibold text-slate-900">{activeStep.title}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{activeStep.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                  {getPaletteItem(activeStep.type).group}
                </span>
                <code className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                  {activeStep.meta}
                </code>
              </div>
            </div>
          </Panel>
        )}

        <Panel position="bottom-left" className="!m-3">
          <CanvasControls />
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function WorkflowPreviewCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

