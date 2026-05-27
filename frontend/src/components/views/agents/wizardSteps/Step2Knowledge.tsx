import React from "react";
import {
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  History,
  Layers,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import type {
  CaseWritePolicy,
  GatewayInfo,
  KnowledgeBaseCode,
  KnowledgeUseMode,
  WizardFormState,
} from "@/src/components/views/agents/types.ts";

interface Props {
  form: WizardFormState;
  patch: (p: Partial<WizardFormState>) => void;
  disabled: boolean;
  gateway: GatewayInfo | null;
}

const MODELS: Array<{
  id: WizardFormState["model"];
  name: string;
  desc: string;
  badge: string;
  recommended?: boolean;
  available: (g: GatewayInfo | null) => boolean;
}> = [
  {
    id: "deepseek",
    name: "DeepSeek V4 Flash",
    desc: "极速推理、低延迟，POC 默认模型（deepseek-chat）",
    badge: "POC 默认",
    recommended: true,
    available: (g) => g?.provider === "deepseek",
  },
  {
    id: "qwen",
    name: "Qwen Max",
    desc: "阿里云通义千问，DashScope 兼容 OpenAI 模式",
    badge: "可选",
    available: (g) => g?.provider === "qwen",
  },
];

const KNOWLEDGE_BASES: Array<{
  code: KnowledgeBaseCode;
  name: string;
  owner: string;
  visibility: string;
  content: string;
}> = [
  {
    code: "finance_policy",
    name: "财务核算制度库",
    owner: "财务数据治理组",
    visibility: "财务组织 / 管理员",
    content: "收入确认、回款核销、坏账准备等制度口径",
  },
  {
    code: "settlement_sop",
    name: "DMS / SAP 对账 SOP",
    owner: "数据治理 / IT",
    visibility: "财务组织 / IT 角色",
    content: "系统字段口径、对账流程、异常处理步骤",
  },
  {
    code: "data_dictionary",
    name: "数据字典与指标口径",
    owner: "平台管理员",
    visibility: "全局只读",
    content: "字段含义、指标计算、接口返回结构",
  },
];

const caseWritePolicyLabels: Record<CaseWritePolicy, string> = {
  manual_confirmed: "人工确认后入库",
  disabled: "不写入案例库",
};

const knowledgeUseModeLabels: Record<KnowledgeUseMode, string> = {
  retrieve: "检索增强",
  cite: "报告引用",
  eval: "评测参考",
};

export function Step2Knowledge({ form, patch, disabled, gateway }: Props) {
  const toggleKnowledge = (code: KnowledgeBaseCode) => {
    if (disabled) return;
    patch({
      mountedKnowledgeBases: form.mountedKnowledgeBases.includes(code)
        ? form.mountedKnowledgeBases.filter((item) => item !== code)
        : [...form.mountedKnowledgeBases, code],
    });
  };

  const patchKnowledgeMode = (code: KnowledgeBaseCode, mode: KnowledgeUseMode) => {
    if (disabled) return;
    patch({ knowledgeUseModes: { ...form.knowledgeUseModes, [code]: mode } });
  };

  return (
    <div className="w-full animate-in slide-in-from-bottom-4 space-y-4 p-4 duration-500 sm:p-5 xl:p-6">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Cpu className="h-5 w-5 text-blue-600" />
              模型、记忆与知识库
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Memory Service 负责短期会话与案例沉淀；知识库作为独立资源挂载，可被多个 Agent 场景复用。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <SummaryPill label="Session TTL" value={`${form.sessionTtlHours}h`} />
            <SummaryPill label="案例库" value={form.caseMemoryEnabled ? "启用" : "关闭"} />
            <SummaryPill label="知识库" value={form.mountedKnowledgeBases.length} />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          <ConfigBlock
            icon={Brain}
            title="底层大模型"
            desc="选择该 Agent 调用的模型 Provider；实际可用性由 Model Gateway 决定。"
          >
            {gateway && (
              <div
                className={cn(
                  "mb-3 inline-flex items-center gap-2 rounded border px-2.5 py-1 text-[11px] font-bold",
                  gateway.provider === "fallback_template"
                    ? "border-slate-200 bg-slate-50 text-slate-600"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                <CheckCircle2 className="h-3 w-3" />
                当前 Model Gateway：{gateway.provider}（{gateway.model}）
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {MODELS.map((m) => {
                const available = m.available(gateway);
                const selected = form.model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled || !available}
                    onClick={() => patch({ model: m.id })}
                    className={cn(
                      "flex min-h-[110px] flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition-all",
                      selected
                        ? "border-blue-600 bg-blue-50/50"
                        : "border-slate-200 bg-white hover:border-blue-300",
                      !available && "cursor-not-allowed opacity-50 hover:border-slate-200",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-slate-50">
                        <Brain className="h-4 w-4 text-blue-600" />
                      </div>
                      {selected && available && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div className="text-sm font-bold text-slate-800">{m.name}</div>
                    <div className="text-[11px] leading-5 text-slate-500">{m.desc}</div>
                    <Badge active={Boolean(m.recommended)}>{m.badge}</Badge>
                  </button>
                );
              })}
            </div>
          </ConfigBlock>

          <ConfigBlock
            icon={History}
            title="Memory Service"
            desc="一期采用 Session 短记忆与 Case 历史案例库；向量检索和更完整的长期记忆放入二期。"
          >
            <div className="grid gap-3 xl:grid-cols-2">
              <MemoryCard
                icon={Layers}
                title="Session Memory"
                subtitle="短期记忆 · Redis TTL"
                enabled={form.sessionMemoryEnabled}
                disabled={disabled}
                onToggle={() => patch({ sessionMemoryEnabled: !form.sessionMemoryEnabled })}
              >
                <div className="mt-3 grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)]">
                  <label className="text-xs font-bold text-slate-600">
                    TTL 小时
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={form.sessionTtlHours}
                      disabled={disabled || !form.sessionMemoryEnabled}
                      onChange={(e) => patch({ sessionTtlHours: Number(e.target.value) })}
                      className="mt-1 h-8 w-full rounded border border-slate-200 px-2 text-xs outline-none focus:border-blue-400 disabled:bg-slate-100"
                    />
                  </label>
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                    保存当前用户在一次归因任务中的输入、确认与补充说明，用于复核闭环内的上下文延续。
                  </div>
                </div>
              </MemoryCard>

              <MemoryCard
                icon={Database}
                title="Case Library"
                subtitle="长期案例记忆 · PostgreSQL"
                enabled={form.caseMemoryEnabled}
                disabled={disabled}
                onToggle={() => patch({ caseMemoryEnabled: !form.caseMemoryEnabled })}
              >
                <div className="mt-3 grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
                  <label className="text-xs font-bold text-slate-600">
                    入库策略
                    <select
                      value={form.caseWritePolicy}
                      disabled={disabled || !form.caseMemoryEnabled}
                      onChange={(e) => patch({ caseWritePolicy: e.target.value as CaseWritePolicy })}
                      className="mt-1 h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400 disabled:bg-slate-100"
                    >
                      {Object.entries(caseWritePolicyLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                    Run 经人工确认后沉淀为案例，供 Skill 评测、相似案例提示和置信度调节使用。
                  </div>
                </div>
              </MemoryCard>
            </div>
          </ConfigBlock>

          <ConfigBlock
            icon={BookOpen}
            title="知识库挂载"
            desc="知识库是可复用资源，不等同于记忆；上传归属和可见范围由知识库自身 RBAC 控制。"
          >
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <Header columns="grid-cols-[minmax(10rem,1fr)_8rem_9rem_8rem_5rem]">
                <div>知识库</div>
                <div>上传归属</div>
                <div>可见范围</div>
                <div>使用方式</div>
                <div className="text-right">挂载</div>
              </Header>
              {KNOWLEDGE_BASES.map((kb) => {
                const enabled = form.mountedKnowledgeBases.includes(kb.code);
                return (
                  <div
                    key={kb.code}
                    className={cn(
                      "flex items-center gap-3 border-t border-slate-100 px-3 py-3 first:border-t-0",
                      enabled ? "bg-white" : "bg-slate-50/70",
                    )}
                  >
                    <div className="grid flex-1 grid-cols-[minmax(10rem,1fr)_8rem_9rem_8rem] items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <FileText className="h-4 w-4 text-blue-600" />
                          {kb.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">{kb.content}</div>
                      </div>
                      <Badge>{kb.owner}</Badge>
                      <div className="text-xs text-slate-500">{kb.visibility}</div>
                      <select
                        value={form.knowledgeUseModes[kb.code]}
                        disabled={disabled || !enabled}
                        onChange={(e) =>
                          patchKnowledgeMode(kb.code, e.target.value as KnowledgeUseMode)
                        }
                        className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {Object.entries(knowledgeUseModeLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleKnowledge(kb.code)}
                      className="ml-auto shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 disabled:hover:bg-transparent"
                    >
                      {enabled ? (
                        <ToggleRight className="h-7 w-7 text-blue-600" />
                      ) : (
                        <ToggleLeft className="h-7 w-7 text-slate-300" />
                      )}
                    </button>
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

function SummaryPill({ label, value }: { label: string; value: string | number }) {
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

function MemoryCard({
  icon: Icon,
  title,
  subtitle,
  enabled,
  disabled,
  onToggle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        enabled ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-slate-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-200 bg-white">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="font-bold text-slate-900">{title}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">{subtitle}</div>
          </div>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          className="rounded p-1 hover:bg-white disabled:hover:bg-transparent"
        >
          {enabled ? (
            <ToggleRight className="h-7 w-7 text-blue-600" />
          ) : (
            <ToggleLeft className="h-7 w-7 text-slate-300" />
          )}
        </button>
      </div>
      {children}
    </div>
  );
}

function Header({ columns, children }: { columns: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500", columns)}>
      {children}
    </div>
  );
}

function Badge({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      <Check className="h-3 w-3 text-blue-500" />
      {children}
    </span>
  );
}

