import type { Node } from "@xyflow/react";
import type { WorkflowNodeData } from "../WorkflowNode.tsx";
import { getPaletteItem } from "../shared/nodeRegistry.ts";

interface Props {
  node: Node<WorkflowNodeData> | null;
  onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void;
}

export function NodeInspector({ node, onChange }: Props) {
  if (!node) {
    return (
      <aside className="flex w-[260px] shrink-0 flex-col border-l border-slate-200 bg-white p-4">
        <p className="text-[12px] text-slate-500">选中画布上的节点以编辑属性</p>
      </aside>
    );
  }

  const d = node.data;

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-slate-900">节点配置</h3>
        <p className="mt-0.5 text-[10px] text-slate-500">{getPaletteItem(d.type).group}</p>
      </div>
      <div className="space-y-4 p-4">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-slate-500">类型</span>
          <input
            readOnly
            value={d.type}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-slate-500">标题</span>
          <input
            value={d.title}
            onChange={(e) => onChange(node.id, { title: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-slate-500">说明</span>
          <textarea
            value={d.desc}
            rows={3}
            onChange={(e) => onChange(node.id, { desc: e.target.value })}
            className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-slate-500">Meta 标识</span>
          <input
            value={d.meta}
            onChange={(e) => onChange(node.id, { meta: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-[11px] focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <p className="rounded-lg bg-slate-50 p-2 font-mono text-[9px] text-slate-400">id: {node.id}</p>
      </div>
    </aside>
  );
}
