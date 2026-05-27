import React, { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

interface CollapsibleProcessGuideProps {
  steps: string[];
  defaultOpen?: boolean;
}

export function CollapsibleProcessGuide({ steps, defaultOpen = false }: CollapsibleProcessGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-1 text-left text-xs font-bold text-slate-600 hover:text-slate-900"
      >
        <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="flex-1">处理流程说明</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <ol className="mb-2 mt-2 flex flex-wrap gap-x-2 gap-y-1 pl-5 text-[11px] text-slate-500">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-1">
              <span className="font-bold text-slate-400">{i + 1}.</span>
              {step}
              {i < steps.length - 1 && <span className="text-slate-300">→</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
