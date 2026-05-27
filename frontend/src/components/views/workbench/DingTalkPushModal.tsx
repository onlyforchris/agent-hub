import React from "react";
import { Bell, CheckCircle2, X } from "lucide-react";
import { motion } from "motion/react";
import type { ReconciliationDifference } from "@/src/types.ts";
import { typeLabels } from "./constants.ts";

interface DingTalkPushModalProps {
  diff: ReconciliationDifference;
  assignee: string;
  onClose: () => void;
}

export function DingTalkPushModal({ diff, assignee, onClose }: DingTalkPushModalProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <span className="font-bold text-slate-900">钉钉复核通知（演示）</span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-700">
              <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">钉钉</span>
              对账治理 Agent
            </div>
            <p className="text-sm font-bold text-slate-900">{assignee}，请确认差异复核</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              单据 <span className="font-mono font-bold text-slate-800">{diff.billNo}</span>（
              {typeLabels[diff.type]}）已完成归因，请查看证据并确认责任环节。
            </p>
            <p className="mt-2 text-xs text-slate-500">差异金额 ¥{diff.diffAmount.toLocaleString()} · 仅推送摘要，明细请登录平台查看</p>
            <button className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white">查看证据并确认</button>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>已推送至 {assignee}，工作台状态同步为「待责任方确认」</span>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            知道了
          </button>
        </div>
      </motion.div>
    </div>
  );
}

