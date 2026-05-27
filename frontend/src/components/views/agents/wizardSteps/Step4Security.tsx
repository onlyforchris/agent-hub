import React from "react";
import {
  Check,
  Database,
  FileStack,
  KeyRound,
  Plug,
  RadioTower,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import type {
  AgentOperableResource,
  AgentReadableResource,
  ConfirmationReviewer,
  ManualConfirmationResource,
  ModelAccessPrincipal,
  OperationPolicy,
  PrincipalAccessLevel,
  ReadableAccessLevel,
  ToolApi,
  WizardFormState,
} from "@/src/components/views/agents/types.ts";

interface Props {
  form: WizardFormState;
  patch: (p: Partial<WizardFormState>) => void;
  disabled: boolean;
  tools: ToolApi[];
}

const PRINCIPALS: Array<{ key: ModelAccessPrincipal; name: string; type: string; scope: string }> = [
  { key: "finance_org", name: "财务数据治理组", type: "组织", scope: "处理收入回款差异" },
  { key: "data_team", name: "数据治理 / IT", type: "组织", scope: "查看 Trace 与接口状态" },
  { key: "admin_role", name: "平台管理员", type: "角色", scope: "维护配置与发布状态" },
];

const READABLE_RESOURCES: Array<{
  key: AgentReadableResource;
  name: string;
  source: "API" | "ETL" | "系统库";
  permission: string;
  desc: string;
  icon: React.ElementType;
}> = [
  {
    key: "api_diff_list",
    name: "帆软差异清单接口",
    source: "API",
    permission: "接口调用",
    desc: "拉取待归因差异",
    icon: Plug,
  },
  {
    key: "etl_finance_table",
    name: "财务宽表 / 对账明细",
    source: "ETL",
    permission: "表查询",
    desc: "作为规则计算输入",
    icon: FileStack,
  },
  {
    key: "db_trace_case",
    name: "Trace / 案例库",
    source: "系统库",
    permission: "库查询",
    desc: "读取执行过程与历史案例",
    icon: Database,
  },
];

const OPERABLE_RESOURCES: Array<{
  key: AgentOperableResource;
  name: string;
  operation: string;
  desc: string;
}> = [
  { key: "rule_engine", name: "规则引擎", operation: "执行规则", desc: "金额、状态、重复结算等规则" },
  { key: "report_template", name: "报告模板", operation: "渲染报告", desc: "生成归因报告，不写外部系统" },
  { key: "notify_service", name: "通知服务", operation: "发起通知", desc: "复核提醒与协同消息" },
];

const CONFIRMATIONS: Array<{
  key: ManualConfirmationResource;
  name: string;
  trigger: string;
}> = [
  { key: "notify_service", name: "通知外发", trigger: "发送复核提醒、协同消息" },
  { key: "db_case_archive", name: "结论入库", trigger: "AI 归因结论写入案例库" },
  { key: "etl_reprocess", name: "ETL 重跑 / 补数", trigger: "触发数据重算或批次补数" },
];

const principalLevelLabels: Record<PrincipalAccessLevel, string> = {
  use: "仅使用",
  manage: "配置管理",
};

const readableLevelLabels: Record<ReadableAccessLevel, string> = {
  read: "只读",
  masked_read: "脱敏只读",
};

const operationPolicyLabels: Record<OperationPolicy, string> = {
  allow: "允许",
  confirm: "需确认",
};

const reviewerLabels: Record<ConfirmationReviewer, string> = {
  business_owner: "业务负责人",
  finance_reviewer: "财务复核人",
  platform_admin: "平台管理员",
};

export function Step4Security({ form, patch, disabled, tools }: Props) {
  const selectedTools = tools.filter((t) => form.selectedToolNames.includes(t.name));
  const sideEffectCounts = {
    none: selectedTools.filter((t) => t.sideEffect === "none").length,
    notify: selectedTools.filter((t) => t.sideEffect === "notify").length,
    write: selectedTools.filter((t) => t.sideEffect === "write").length,
  };

  const toggleList = <T extends string>(
    key: T,
    current: T[],
    field: keyof WizardFormState,
  ) => {
    if (disabled) return;
    patch({
      [field]: current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    } as Partial<WizardFormState>);
  };

  const patchRecord = <K extends string, V extends string>(
    field: keyof WizardFormState,
    current: Record<K, V>,
    key: K,
    value: V,
  ) => {
    if (disabled) return;
    patch({ [field]: { ...current, [key]: value } } as Partial<WizardFormState>);
  };

  return (
    <div className="w-full animate-in slide-in-from-bottom-4 space-y-4 p-4 duration-500 sm:p-5 xl:p-6">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <ShieldAlert className="h-5 w-5 text-blue-600" />
              资源授权配置
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              配置谁能用、Agent 能读什么、能操作什么，以及哪些动作必须人工确认。
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <SummaryPill label="主体" value={form.modelAccessPrincipals.length} />
            <SummaryPill label="可读" value={form.agentReadableResources.length} />
            <SummaryPill label="可操作" value={form.agentOperableResources.length} />
            <SummaryPill label="需确认" value={form.manualConfirmationResources.length} />
          </div>
        </div>

        <div className="min-w-0 divide-y divide-slate-100">
              <ConfigBlock
              icon={UserRoundCheck}
              title="模型与 Agent 使用授权"
              desc="勾选授权主体，并为每个主体选择访问级别。"
            >
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <Header columns="grid-cols-[minmax(8rem,1.1fr)_5rem_minmax(8rem,1fr)_8rem_5rem]">
                  <div>授权主体</div>
                  <div>类型</div>
                  <div>范围</div>
                  <div>访问级别</div>
                  <div className="text-right">启用</div>
                </Header>
                {PRINCIPALS.map((item) => {
                  const enabled = form.modelAccessPrincipals.includes(item.key);
                  return (
                    <div key={item.key}>
                      <ConfigRow
                        enabled={enabled}
                        disabled={disabled}
                        onToggle={() =>
                          toggleList(item.key, form.modelAccessPrincipals, "modelAccessPrincipals")
                        }
                      >
                        <div className="grid flex-1 grid-cols-[minmax(8rem,1.1fr)_5rem_minmax(8rem,1fr)_8rem] items-center gap-3">
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <Badge>{item.type}</Badge>
                          <div className="text-xs text-slate-500">{item.scope}</div>
                          <SelectControl
                            value={form.principalAccessLevels[item.key]}
                            options={principalLevelLabels}
                            disabled={disabled || !enabled}
                            onChange={(value) =>
                              patchRecord(
                                "principalAccessLevels",
                                form.principalAccessLevels,
                                item.key,
                                value as PrincipalAccessLevel,
                              )
                            }
                          />
                        </div>
                      </ConfigRow>
                    </div>
                  );
                })}
              </div>
              </ConfigBlock>

              <ConfigBlock
                icon={RadioTower}
                title="Agent 可访问的数据资源"
                desc="数据接入仅来自 API、ETL 和系统库；每个资源可单独选择访问方式。"
              >
              <div className="mb-3 flex flex-wrap gap-2">
                {["API", "ETL", "系统库"].map((source) => (
                  <span
                    key={source}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-600"
                  >
                    {source}
                  </span>
                ))}
                <label className="ml-auto inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.desensitize}
                    disabled={disabled}
                    onChange={(e) => patch({ desensitize: e.target.checked })}
                    className="h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  模型调用前脱敏
                </label>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                {READABLE_RESOURCES.map((item) => {
                  const enabled = form.agentReadableResources.includes(item.key);
                  const Icon = item.icon;
                  return (
                    <div key={item.key}>
                      <ConfigRow
                        enabled={enabled}
                        disabled={disabled}
                        onToggle={() =>
                          toggleList(item.key, form.agentReadableResources, "agentReadableResources")
                        }
                      >
                        <div className="grid flex-1 grid-cols-[minmax(10rem,1fr)_5rem_6rem_8rem_minmax(8rem,1fr)] items-center gap-3">
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            <Icon className="h-4 w-4 text-blue-600" />
                            {item.name}
                          </div>
                          <Badge>{item.source}</Badge>
                          <div className="text-xs font-bold text-slate-600">{item.permission}</div>
                          <SelectControl
                            value={form.readableAccessLevels[item.key]}
                            options={readableLevelLabels}
                            disabled={disabled || !enabled}
                            onChange={(value) =>
                              patchRecord(
                                "readableAccessLevels",
                                form.readableAccessLevels,
                                item.key,
                                value as ReadableAccessLevel,
                              )
                            }
                          />
                          <div className="text-xs text-slate-500">{item.desc}</div>
                        </div>
                      </ConfigRow>
                    </div>
                  );
                })}
              </div>
              </ConfigBlock>

              <ConfigBlock
                icon={Wrench}
                title="Agent 可操作的中台资源"
                desc="配置 Agent 对中台资源的操作策略：允许、需确认或关闭。"
              >
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_14rem]">
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  {OPERABLE_RESOURCES.map((item) => {
                    const enabled = form.agentOperableResources.includes(item.key);
                    return (
                      <div key={item.key}>
                        <ConfigRow
                          enabled={enabled}
                          disabled={disabled}
                          onToggle={() =>
                            toggleList(
                              item.key,
                              form.agentOperableResources,
                              "agentOperableResources",
                            )
                          }
                        >
                          <div className="grid flex-1 grid-cols-[minmax(8rem,1fr)_6rem_8rem_minmax(8rem,1fr)] items-center gap-3">
                            <div className="font-bold text-slate-800">{item.name}</div>
                            <Badge>{item.operation}</Badge>
                            <SelectControl
                              value={form.operationPolicies[item.key]}
                              options={operationPolicyLabels}
                              disabled={disabled || !enabled}
                              onChange={(value) =>
                                patchRecord(
                                  "operationPolicies",
                                  form.operationPolicies,
                                  item.key,
                                  value as OperationPolicy,
                                )
                              }
                            />
                            <div className="text-xs text-slate-500">{item.desc}</div>
                          </div>
                        </ConfigRow>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-2">
                  <StatCard label="无副作用 Tool" value={sideEffectCounts.none} tone="emerald" />
                  <StatCard label="通知类 Tool" value={sideEffectCounts.notify} tone="amber" />
                  <StatCard label="写入类 Tool" value={sideEffectCounts.write} tone="slate" />
                </div>
              </div>
              </ConfigBlock>

              <ConfigBlock
                icon={KeyRound}
                title="需要人工确认的资源操作"
                desc="启用确认点，并指定不同动作的确认人。"
              >
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <Header columns="grid-cols-[minmax(8rem,1fr)_minmax(11rem,1.2fr)_9rem_5rem]">
                  <div>动作</div>
                  <div>触发条件</div>
                  <div>确认人</div>
                  <div className="text-right">启用</div>
                </Header>
                {CONFIRMATIONS.map((item) => {
                  const enabled = form.manualConfirmationResources.includes(item.key);
                  return (
                    <div key={item.key}>
                      <ConfigRow
                        enabled={enabled}
                        disabled={disabled}
                        onToggle={() =>
                          toggleList(
                            item.key,
                            form.manualConfirmationResources,
                            "manualConfirmationResources",
                          )
                        }
                      >
                        <div className="grid flex-1 grid-cols-[minmax(8rem,1fr)_minmax(11rem,1.2fr)_9rem] items-center gap-3">
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <div className="text-xs text-slate-500">{item.trigger}</div>
                          <SelectControl
                            value={form.confirmationReviewers[item.key]}
                            options={reviewerLabels}
                            disabled={disabled || !enabled}
                            onChange={(value) =>
                              patchRecord(
                                "confirmationReviewers",
                                form.confirmationReviewers,
                                item.key,
                                value as ConfirmationReviewer,
                              )
                            }
                          />
                        </div>
                      </ConfigRow>
                    </div>
                  );
                })}
              </div>
              </ConfigBlock>
        </div>
      </section>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5">
      <div className="font-bold text-slate-800">{value}</div>
      <div className="text-slate-500">{label}</div>
    </div>
  );
}

function ConfigBlock({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-4">
      <div className="mb-3">
        <h5 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Icon className="h-4 w-4 text-blue-600" />
          {title}
        </h5>
        <p className="mt-1 text-xs text-slate-500">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function Header({ columns, children }: { columns: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500", columns)}>
      {children}
    </div>
  );
}

function ConfigRow({
  enabled,
  onToggle,
  disabled,
  children,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-slate-100 px-3 py-3 first:border-t-0",
        enabled ? "bg-white" : "bg-slate-50/70",
      )}
    >
      {children}
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="ml-auto shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 disabled:hover:bg-transparent"
        title={enabled ? "停用" : "启用"}
      >
        {enabled ? (
          <ToggleRight className="h-7 w-7 text-blue-600" />
        ) : (
          <ToggleLeft className="h-7 w-7 text-slate-300" />
        )}
      </button>
    </div>
  );
}

function SelectControl({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
    >
      {Object.entries(options).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
      <Check className="h-3 w-3 text-blue-500" />
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "slate";
}) {
  const cls: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <div className={cn("rounded-lg border p-3", cls[tone])}>
      <div className="text-[10px] font-bold uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

