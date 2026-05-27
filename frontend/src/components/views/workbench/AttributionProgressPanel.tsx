import React from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import { analysisProgressSteps } from "./constants.ts";

interface AttributionProgressPanelProps {
  activeStepIndex: number;
  isComplete: boolean;
}

export function AttributionProgressPanel({ activeStepIndex, isComplete }: AttributionProgressPanelProps) {
  return (
    <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50/30 p-5">
      <div className="mb-4 text-center">
        <div className="font-bold text-slate-900">{isComplete ? "归因完成" : "正在自动排查…"}</div>
        <div className="mt-1 text-sm text-slate-500">
          {isComplete ? "已生成证据链与说明报告，请人工复核" : "按财务排查步骤逐环节核对，模型仅组织报告文本"}
        </div>
      </div>

      <div className="space-y-2">
        {analysisProgressSteps.map((step, index) => {
          const done = isComplete || index < activeStepIndex;
          const active = !isComplete && index === activeStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                active && "border-blue-300 bg-white shadow-sm",
                done && !active && "border-emerald-100 bg-white/80",
                !done && !active && "border-transparent bg-transparent opacity-50",
              )}
            >
              <div className="mt-0.5 shrink-0">
                {done && !active ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-bold", active ? "text-blue-700" : "text-slate-800")}>{step.label}</div>
                <div className="text-xs text-slate-500">{step.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

