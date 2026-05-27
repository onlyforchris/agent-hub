import React, { useState } from "react";
import { ArrowLeft, CheckCircle, Database, FileSpreadsheet, PlayCircle, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";

interface TaskImportProcessProps {
  onClose: () => void;
  onComplete: () => void;
}

const sources = ["帆软差异清单", "DMS结算单", "DMS收入台账", "SAP过账数据", "接口日志", "门店主数据"];

export function TaskImportProcess({ onClose, onComplete }: TaskImportProcessProps) {
  const [selected, setSelected] = useState<string[]>(sources.slice(0, 3));

  const toggle = (source: string) => {
    setSelected((prev) => (prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-8 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="rounded p-2 text-slate-500 hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="font-bold text-slate-900">数据接入配置</h2>
              <p className="mt-1 text-xs text-slate-500">选择归因任务需要挂载的数据源。</p>
            </div>
          </div>
          <span className="rounded border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">数据源</span>
        </div>

        <div className="overflow-auto p-6">
          <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-slate-700">
            <div className="mb-1 flex items-center gap-2 font-bold text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              数据边界
            </div>
            平台仅挂载只读数据源，模型只接收脱敏摘要，正式证据保留在内网平台绑定展示。
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => {
              const active = selected.includes(source);
              return (
                <button
                  key={source}
                  onClick={() => toggle(source)}
                  className={`rounded-lg border p-5 text-left transition-colors ${
                    active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-white text-blue-600 shadow-sm">
                    {source.includes("清单") || source.includes("台账") ? <FileSpreadsheet className="h-5 w-5" /> : <Database className="h-5 w-5" />}
                  </div>
                  <div className="font-bold text-slate-900">{source}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">用于规则计算和结构化证据链展示。</div>
                  {active && (
                    <div className="mt-4 flex items-center gap-1 text-xs font-bold text-blue-700">
                      <CheckCircle className="h-4 w-4" />
                      已挂载
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button onClick={onClose} className="rounded border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
            取消
          </button>
          <button onClick={onComplete} className="inline-flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">
            <PlayCircle className="h-4 w-4" />
            生成差异
          </button>
        </div>
      </motion.div>
    </div>
  );
}
