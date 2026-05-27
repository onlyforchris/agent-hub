import React from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils.ts";

export interface BatchAnalyzeProgress {
  current: number;
  total: number;
  billNo: string;
  done: string[];
  failed: string[];
}

interface BatchAnalyzeModalProps {
  progress: BatchAnalyzeProgress;
  running: boolean;
  onClose: () => void;
}

export function BatchAnalyzeModal({ progress, running, onClose }: BatchAnalyzeModalProps) {
  const percent = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
  const finished = !running && progress.current >= progress.total && progress.total > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="font-bold text-slate-900">{running ? "批量归因进行中" : finished ? "批量归因完成" : "批量归因"}</div>
          {!running && (
            <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-5 p-5">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-700">
                {running ? `正在处理 ${progress.billNo}` : `已完成 ${progress.current} / ${progress.total} 笔`}
              </span>
              <span className="font-bold text-blue-700">{percent}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  finished ? "bg-emerald-500" : "bg-blue-600",
                )}
                style={{ width: `${finished ? 100 : percent}%` }}
              />
            </div>
          </div>

          {running && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              按差异类型依次执行排查流程，请稍候…
            </div>
          )}

          {progress.done.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-bold text-slate-500">已完成</div>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {progress.done.map((billNo) => (
                  <div key={billNo} className="flex items-center gap-2 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {billNo}
                  </div>
                ))}
              </div>
            </div>
          )}

          {progress.failed.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-bold text-rose-600">失败</div>
              <div className="space-y-1">
                {progress.failed.map((billNo) => (
                  <div key={billNo} className="text-xs text-rose-600">
                    {billNo}
                  </div>
                ))}
              </div>
            </div>
          )}

          {finished && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              成功 {progress.done.length} 笔
              {progress.failed.length > 0 ? `，失败 ${progress.failed.length} 笔` : ""}。请在「需复核」中逐条确认结论。
            </div>
          )}
        </div>

        {!running && (
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              关闭
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

