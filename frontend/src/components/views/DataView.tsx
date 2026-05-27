import React from "react";
import { AlertTriangle, CheckCircle2, Database, FileSpreadsheet, HardDrive, KeyRound, Server, Table2 } from "lucide-react";
import { motion } from "motion/react";

const sources = [
  { name: "帆软差异清单", type: "差异入口", mode: "文件/API", status: "已接入", icon: Table2, desc: "承接已发现的单据级差异，作为归因流程的起点。" },
  { name: "DMS结算单", type: "业务源单", mode: "只读连接", status: "已接入", icon: FileSpreadsheet, desc: "用于核对结算单金额、客户、MDM ID 与源头业务状态。" },
  { name: "DMS收入台账", type: "核心证据", mode: "只读连接", status: "已接入", icon: Database, desc: "用于识别 MDM 异常、金额翻倍和重复插入。" },
  { name: "SAP过账数据", type: "财务底账", mode: "只读连接", status: "已接入", icon: HardDrive, desc: "用于确认收入过账金额、凭证和开票状态。" },
  { name: "接口日志", type: "回传证据", mode: "日志检索", status: "已接入", icon: Server, desc: "用于核对 SAP 回传、DMS 接收和状态更新链路。" },
  { name: "门店主数据", type: "主数据", mode: "主数据服务", status: "已接入", icon: KeyRound, desc: "用于核对门店、客户、MDM ID 映射和历史组织归属。" },
  { name: "组织变更记录", type: "历史依据", mode: "主数据服务", status: "已接入", icon: AlertTriangle, desc: "用于判断历史归属变更是否导致收入台账异常。" },
];

export function DataView() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <HardDrive className="h-5 w-5 text-blue-600" />
          数据源治理
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          管理差异归因所需的数据源、连接方式和证据访问状态。
        </p>
      </div>

      <div className="p-6">
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
            <div className="text-xs font-bold text-blue-700">数据接入边界</div>
            <div className="mt-2 text-sm leading-6 text-slate-700">只读接入、先脱敏、后分析；模型不直接访问数据库。</div>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-5">
            <div className="text-xs font-bold text-emerald-700">证据链生成</div>
            <div className="mt-2 text-sm leading-6 text-slate-700">按差异类型调用对应 Skill，输出结构化证据。</div>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-5">
            <div className="text-xs font-bold text-amber-700">审计留痕</div>
            <div className="mt-2 text-sm leading-6 text-slate-700">记录数据查询、规则命中、模型调用和人工复核。</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => {
            const Icon = source.icon;
            return (
              <div key={source.name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900">{source.name}</h4>
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                        {source.type}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{source.desc}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="font-mono text-xs font-bold text-slate-500">{source.mode}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    {source.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-900 p-5 text-white">
          <h4 className="font-bold">数据流说明</h4>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            帆软差异清单进入平台后，先完成字段标准化和主键关联，再由差异类型识别服务选择对应 Skill。规则引擎在内网完成金额、状态、重复记录和字段一致性计算，最后将脱敏摘要交给模型生成报告文本。
          </p>
        </div>
      </div>
    </motion.div>
  );
}
