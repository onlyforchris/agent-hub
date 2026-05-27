import { PALETTE_ITEMS } from "../shared/nodeRegistry.ts";
import type { NodeKind } from "@/src/types/workflow.ts";

interface Props {
  onAdd: (kind: NodeKind) => void;
}

export function NodePalette({ onAdd }: Props) {
  const groups = [...new Set(PALETTE_ITEMS.map((p) => p.group))];

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">节点库</h3>
        <p className="mt-0.5 text-[10px] text-slate-400">点击添加到画布</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {groups.map((group) => (
          <div key={group} className="mb-3">
            <div className="mb-1.5 px-1 text-[10px] font-semibold text-slate-400">{group}</div>
            <div className="space-y-1">
              {PALETTE_ITEMS.filter((p) => p.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => onAdd(item.kind)}
                    className="flex w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 px-2 py-2 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white shadow-sm">
                      <Icon className="h-3.5 w-3.5 text-slate-600" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-slate-800">{item.label}</span>
                      <span className="block truncate font-mono text-[9px] text-slate-400">{item.kind}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

