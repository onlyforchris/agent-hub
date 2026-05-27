import type { WorkflowTone } from "./WorkflowNode.tsx";

export type { NodeKind } from "@/src/types/workflow.ts";
export { getNodeRole, type NodeRole } from "./shared/nodeRegistry.ts";

/** 节点配色�?tone 驱动，与 kind 解�?*/
export const NODE_THEME: Record<
  WorkflowTone,
  { accent: string; accentSoft: string; icon: string; badge: string }
> = {
  blue: {
    accent: "bg-blue-500",
    accentSoft: "bg-blue-50 text-blue-700",
    icon: "text-blue-600 bg-blue-50",
    badge: "bg-slate-100 text-slate-500",
  },
  cyan: {
    accent: "bg-cyan-500",
    accentSoft: "bg-cyan-50 text-cyan-800",
    icon: "text-cyan-600 bg-cyan-50",
    badge: "bg-slate-100 text-slate-500",
  },
  indigo: {
    accent: "bg-indigo-500",
    accentSoft: "bg-indigo-50 text-indigo-800",
    icon: "text-indigo-600 bg-indigo-50",
    badge: "bg-slate-100 text-slate-500",
  },
  emerald: {
    accent: "bg-emerald-500",
    accentSoft: "bg-emerald-50 text-emerald-800",
    icon: "text-emerald-600 bg-emerald-50",
    badge: "bg-slate-100 text-slate-500",
  },
  amber: {
    accent: "bg-amber-500",
    accentSoft: "bg-amber-50 text-amber-900",
    icon: "text-amber-600 bg-amber-50",
    badge: "bg-slate-100 text-slate-500",
  },
  rose: {
    accent: "bg-rose-500",
    accentSoft: "bg-rose-50 text-rose-800",
    icon: "text-rose-600 bg-rose-50",
    badge: "bg-slate-100 text-slate-500",
  },
  slate: {
    accent: "bg-slate-500",
    accentSoft: "bg-slate-100 text-slate-700",
    icon: "text-slate-600 bg-slate-100",
    badge: "bg-slate-100 text-slate-500",
  },
};

