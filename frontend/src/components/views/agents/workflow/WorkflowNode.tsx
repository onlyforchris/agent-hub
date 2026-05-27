import { memo, type ElementType } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { CircleStop, Play } from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import type { NodeKind } from "@/src/types/workflow.ts";
import { NODE_THEME } from "./theme.ts";
import type { NodeRole } from "./shared/nodeRegistry.ts";

export type WorkflowTone =
  | "slate"
  | "blue"
  | "cyan"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose";

export type WorkflowNodeData = {
  title: string;
  type: NodeKind;
  icon: ElementType;
  tone: WorkflowTone;
  desc: string;
  meta: string;
  stepIndex: number;
  role?: NodeRole;
  group?: string;
  readOnly?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
};

function PortDot({
  id,
  type,
  position,
  className,
}: {
  id: string;
  type: "source" | "target";
  position: Position;
  className?: string;
}) {
  return (
    <Handle
      id={id}
      type={type}
      position={position}
      className={cn(
        "workflow-handle",
        type === "target" ? "workflow-handle--input" : "workflow-handle--output",
        className,
      )}
    />
  );
}

function WorkflowStepNodeComponent({ data }: NodeProps<Node<WorkflowNodeData>>) {
  const Icon = data.icon;
  const theme = NODE_THEME[data.tone];
  const role = data.role ?? "process";
  const step = String(data.stepIndex).padStart(2, "0");
  const active = data.highlighted;
  const dimmed = data.dimmed;
  const groupLabel = data.group ?? data.type;

  const shell = cn(
    "workflow-node group relative w-[280px] overflow-hidden rounded-xl border bg-white transition-all duration-200",
    active
      ? "border-blue-300 ring-2 ring-blue-400/35 shadow-[0_12px_40px_-12px_rgba(37,99,235,0.35)]"
      : "border-slate-200/90 shadow-[0_4px_24px_-10px_rgba(15,23,42,0.14)] hover:shadow-[0_12px_36px_-12px_rgba(15,23,42,0.16)]",
    dimmed && "opacity-35 saturate-50",
  );

  if (role === "start") {
    return (
      <div className={cn(shell, "border-blue-200/90")}>
        <PortDot id="out-bottom" type="source" position={Position.Bottom} className="!-bottom-[5px]" />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/25">
            <Play className="h-4 w-4 fill-current" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Start</span>
            <div className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">{data.title}</div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{data.desc}</p>
          </div>
        </div>
      </div>
    );
  }

  if (role === "end") {
    return (
      <div className={cn(shell, "border-emerald-200/90")}>
        <PortDot id="in-top" type="target" position={Position.Top} className="!-top-[5px]" />
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
            <CircleStop className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">End</span>
            <div className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">{data.title}</div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{data.desc}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <PortDot id="in-top" type="target" position={Position.Top} className="!-top-[5px]" />
      <PortDot id="out-bottom" type="source" position={Position.Bottom} className="!-bottom-[5px]" />
      <PortDot id="in" type="target" position={Position.Left} className="!-left-[5px] opacity-0 group-hover:opacity-100" />
      <PortDot id="out" type="source" position={Position.Right} className="!-right-[5px] opacity-0 group-hover:opacity-100" />

      <div className={cn("flex items-center gap-2 border-b border-slate-100/90 px-3.5 py-2", theme.accentSoft)}>
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", theme.icon)}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{groupLabel}</span>
        <span className="ml-auto font-mono text-[10px] font-semibold text-slate-400">{data.type}</span>
      </div>

      <div className="px-3.5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] font-bold text-slate-300">{step}</span>
          <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-slate-900">{data.title}</div>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{data.desc}</p>
        <code className="mt-2 block truncate rounded-md bg-slate-50 px-2 py-1 font-mono text-[9px] text-slate-500">
          {data.meta}
        </code>
      </div>
    </div>
  );
}

export const WorkflowStepNode = memo(WorkflowStepNodeComponent);
export const workflowNodeTypes = { workflowStep: WorkflowStepNode };

