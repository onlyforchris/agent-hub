import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

export type WorkflowEdgeData = {
  route?: "flow" | "branch";
  label?: string;
  highlighted?: boolean;
  dimmed?: boolean;
};

function WorkflowBezierEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const edgeData = data as WorkflowEdgeData | undefined;
  const route = edgeData?.route ?? "flow";
  const highlighted = edgeData?.highlighted;
  const dimmed = edgeData?.dimmed;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: route === "flow" ? 0.28 : 0.42,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: highlighted ? "#3b82f6" : "#94a3b8",
          strokeWidth: highlighted ? 2.25 : 1.75,
          strokeLinecap: "round",
          opacity: dimmed ? 0.25 : 1,
          transition: "stroke 0.2s, opacity 0.2s",
          ...style,
        }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none rounded-md border border-slate-200/80 bg-white/95 px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const WorkflowBezierEdge = memo(WorkflowBezierEdgeComponent);
