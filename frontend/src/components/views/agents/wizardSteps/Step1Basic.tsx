import React from "react";
import { Info } from "lucide-react";
import type { WizardFormState } from "@/src/components/views/agents/types.ts";

interface Props {
  form: WizardFormState;
  patch: (p: Partial<WizardFormState>) => void;
  disabled: boolean;
}

export function Step1Basic({ form, patch, disabled }: Props) {
  return (
    <div className="w-full animate-in slide-in-from-bottom-4 p-4 duration-500 sm:p-5 xl:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:p-6">
        <h4 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
          <Info className="h-5 w-5 text-blue-600" />
          基础设定
        </h4>
        <div className="grid gap-4 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(28rem,1.3fr)]">
          <div className="space-y-4">
            <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Agent 名称</label>
            <input
              type="text"
              value={form.name}
              disabled={disabled}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="请输入 Agent 名称"
              className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm"
            />
            </div>
            <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              核心定位 (Identity)
            </label>
            <textarea
              rows={3}
              value={form.identity}
              disabled={disabled}
              onChange={(e) => patch({ identity: e.target.value })}
              placeholder="一句话描述该 Agent 解决的业务问题与边界"
              className="min-h-28 w-full resize-none rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 text-sm"
            />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              System Prompt (系统级提示词)
            </label>
            <textarea
              rows={8}
              value={form.systemPrompt}
              disabled={disabled}
              onChange={(e) => patch({ systemPrompt: e.target.value })}
              placeholder="将在 Model Gateway 调用前注入；建议明确数据边界与禁止动作。"
              className="min-h-52 w-full resize-none rounded-lg border border-slate-300 bg-slate-50/50 px-3 py-2 font-mono text-[12px] font-medium text-blue-900 xl:min-h-64"
            />
            <p className="mt-1.5 text-[10px] text-slate-500">
              POC 阶段会在调用模型前自动追加"禁止自动修复 / 自动过账 / 替代 SAP·DMS·帆软"等强约束。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

