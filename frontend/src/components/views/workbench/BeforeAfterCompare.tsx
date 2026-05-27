import React from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  MessageSquare,
  Monitor,
  Phone,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn } from "../../../lib/utils.ts";

interface BeforeAfterCompareProps {
  batchTotal?: number;
  pendingCount?: number;
}

const beforeSteps = [
  { system: "帆软", action: "查看差异清单，确认单据号与金额" },
  { system: "DMS", action: "查询结算单、收入台账与业务状态" },
  { system: "SAP", action: "核对凭证、过账金额与开票状态" },
  { system: "接口日志", action: "检索回传记录、失败与重试日志" },
  { system: "主数据", action: "比对 MDM ID、门店与组织变更" },
];

const afterSteps = [
  { label: "差异接入", desc: "接收帆软差异清单" },
  { label: "自动排查", desc: "按类型执行排查流程" },
  { label: "证据链", desc: "跨系统证据一次呈现" },
  { label: "推送复核", desc: "钉钉通知责任方确认" },
];

export function BeforeAfterCompare({ batchTotal = 10, pendingCount = 6 }: BeforeAfterCompareProps) {
  const savedMinutesPerDiff = 32;
  const batchSavedHours = Math.round(((pendingCount * savedMinutesPerDiff) / 60) * 10) / 10;

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-900">人工排查 vs 平台归因 — 价值对比</h3>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          月结期间，财务同事的核心痛点不是「有没有差异清单」，而是「差异为什么发生、第一个异常在哪个环节」。
          平台在帆软之后承接归因与复核，不替代现有系统。
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-slate-400" />
              <h4 className="font-bold text-slate-900">Before · 人工跨系统排查</h4>
            </div>
            <p className="mt-1 text-xs text-slate-500">典型单笔差异处理路径</p>
          </div>
          <div className="p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {beforeSteps.map((s) => (
                <span
                  key={s.system}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600"
                >
                  {s.system}
                </span>
              ))}
            </div>
            <div className="space-y-3">
              {beforeSteps.map((step, index) => (
                <div key={step.system} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{step.system}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{step.action}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  单笔耗时
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-900">~40 分钟</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone className="h-3.5 w-3.5" />
                  跨部门协调
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900">电话 / 微信 / 会议</div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              证据散落在多个系统截图与个人笔记中，同类问题重复发生时仍需从头排查。
            </p>
          </div>
        </div>

        <div className="rounded-lg border-2 border-blue-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <h4 className="font-bold text-slate-900">After · 对账治理 Agent 工作台</h4>
            </div>
            <p className="mt-1 text-xs text-slate-500">同一笔差异的处理路径</p>
          </div>
          <div className="p-5">
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
              <Monitor className="h-4 w-4" />
              一个工作台完成归因与复核
            </div>
            <div className="space-y-2">
              {afterSteps.map((step, index) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                    {index + 1}
                  </div>
                  <div className="flex-1 rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2">
                    <div className="text-sm font-bold text-slate-900">{step.label}</div>
                    <div className="text-xs text-slate-500">{step.desc}</div>
                  </div>
                  {index < afterSteps.length - 1 && (
                    <ArrowRight className="hidden h-4 w-4 text-blue-300 sm:block" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-1.5 text-xs text-blue-700">
                  <Clock className="h-3.5 w-3.5" />
                  单笔耗时
                </div>
                <div className="mt-1 text-2xl font-bold text-blue-700">~8 分钟</div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center gap-1.5 text-xs text-blue-700">
                  <MessageSquare className="h-3.5 w-3.5" />
                  协同方式
                </div>
                <div className="mt-1 text-sm font-bold text-blue-800">钉钉推送 + 一键确认</div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              辅助归因、人工确认；不自动改账、不过账。确认后沉淀案例，支撑同类问题快速匹配。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "单笔耗时", before: "40 min", after: "8 min", highlight: true },
          { label: "系统切换", before: "5 个", after: "1 个", highlight: false },
          { label: "证据整理", before: "手工截图", after: "自动生成", highlight: false },
          { label: "跨部门沟通", before: "口头协调", after: "任务推送", highlight: false },
        ].map((row) => (
          <div key={row.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold text-slate-500">{row.label}</div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <div className="text-[10px] text-slate-400">Before</div>
                <div className="text-sm font-bold text-slate-500 line-through decoration-slate-300">{row.before}</div>
              </div>
              <ArrowRight className="mb-1 h-4 w-4 shrink-0 text-blue-400" />
              <div>
                <div className="text-[10px] text-blue-600">After</div>
                <div className={cn("text-sm font-bold", row.highlight ? "text-blue-700" : "text-slate-900")}>
                  {row.after}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Layers className="h-5 w-5 text-emerald-700" />
          <span className="font-bold text-emerald-900">批次价值估算（演示数据）</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-emerald-800">
          本批次共 {batchTotal} 笔差异，当前 {pendingCount} 笔待归因。若全部走平台流程，预计节省约{" "}
          <span className="text-lg font-bold">{batchSavedHours} 人时</span>（按每笔节省 32 分钟估算）。
          关键人员可从「逐笔排查」转向「复核归因结论」。
        </p>
      </div>
    </section>
  );
}
