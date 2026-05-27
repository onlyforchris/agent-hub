import React from "react";
import {
  Activity,
  ArrowDown,
  Bot,
  BrainCircuit,
  Database,
  GitBranch,
  Layers,
  Network,
  Sparkles,
  Waypoints,
  Wrench,
} from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import type { GatewayInfo, WizardFormState } from "@/src/components/views/agents/types.ts";
import { workflowApi } from "@/src/lib/workflowApi.ts";
import {
  DATA_QUALITY_WORKFLOW_TEMPLATE_ID,
  findWorkflowListItem,
  mergeAgentWorkflowTemplates,
} from "@/src/lib/workflowCatalog.ts";
import type { WorkflowListItem } from "@/src/types/workflow.ts";
import { WorkflowPreviewCanvas } from "@/src/components/views/agents/workflow/WorkflowPreviewCanvas.tsx";

interface Props {
  form: WizardFormState;
  patch: (p: Partial<WizardFormState>) => void;
  disabled: boolean;
  gateway: GatewayInfo | null;
}

const EXECUTION_MODES: Array<{
  key: WizardFormState["executionMode"];
  title: string;
  status: string;
  icon: React.ElementType;
  desc: string;
  logic: string;
  available: boolean;
}> = [
  {
    key: "workflow",
    title: "工作流编排模式",
    status: "一期已启用",
    icon: Waypoints,
    desc: "按可视化流程、规则节点和复核路由顺序执行，适合对账治理的稳定闭环。",
    logic: "用于收入回款、合同资产、库存等需要可审计、可回放、可持续沉淀的质检场景。",
    available: true,
  },
  {
    key: "plan_execute",
    title: "计划-执行模式",
    status: "二期开放",
    icon: GitBranch,
    desc: "先生成排查计划，再按计划调度已授权 Tool、规则和模型。",
    logic: "适合数据范围扩大、路径不固定，但仍需要人工可追溯的归因场景。",
    available: false,
  },
  {
    key: "react",
    title: "自主推理模式",
    status: "远期规划",
    icon: BrainCircuit,
    desc: "模型根据观察结果自主决定下一步动作，并持续写入 Trace。",
    logic: "适合私有化模型、权限边界和回放审计成熟后的复杂链路归因。",
    available: false,
  },
];

const LOOP_STAGES = ["模板配置", "只读预览", "运行 Trace", "复核回写", "持续优化"];

export function Step5Runtime({ form, patch, disabled, gateway }: Props) {
  const [templates, setTemplates] = React.useState<WorkflowListItem[]>([]);
  const selectedTemplate = form.workflowTemplateId || DATA_QUALITY_WORKFLOW_TEMPLATE_ID;

  React.useEffect(() => {
    void workflowApi
      .list({ status: "published", category: "data_quality" })
      .then((items) => setTemplates(mergeAgentWorkflowTemplates(items)))
      .catch(() => setTemplates(mergeAgentWorkflowTemplates([])));
  }, []);

  React.useEffect(() => {
    if (!form.workflowTemplateId) {
      patch({ workflowTemplateId: DATA_QUALITY_WORKFLOW_TEMPLATE_ID });
    }
  }, [form.workflowTemplateId, patch]);

  const openWorkflowEditor = () => {
    sessionStorage.setItem("workflow-editor-id", selectedTemplate);
    window.dispatchEvent(
      new CustomEvent("agent-hub-tab-switch", { detail: { tab: "workflows" } }),
    );
    window.dispatchEvent(
      new CustomEvent("workflow-open-editor", { detail: { workflowId: selectedTemplate } }),
    );
  };
  const selectedMode =
    EXECUTION_MODES.find((mode) => mode.key === form.executionMode) ?? EXECUTION_MODES[0];
  const SelectedModeIcon = selectedMode.icon;

  return (
    <div className="w-full animate-in slide-in-from-bottom-4 space-y-5 p-4 duration-500 sm:p-5 xl:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:p-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h4 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <GitBranch className="h-5 w-5 text-blue-600" />
              运行策略选择
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              配置 Agent 的执行方式，决定 Planner 如何调度 Skill、Tool、规则、模型和复核路由。
            </p>
          </div>
          <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700">
            Agent 配置向导 / 第 5 步
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {EXECUTION_MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = selectedMode.key === mode.key;
            const selectable = mode.available && !disabled;
            return (
              <button
                key={mode.key}
                type="button"
                disabled={!selectable}
                onClick={() => patch({ executionMode: mode.key })}
                className={cn(
                  "min-h-[180px] rounded-lg border p-4 text-left transition-all",
                  selected
                    ? "border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100"
                    : "border-slate-200 bg-slate-50",
                  selectable && "hover:border-blue-300 hover:bg-white",
                  !mode.available && "cursor-not-allowed opacity-75",
                  disabled && mode.available && "cursor-default",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded border bg-white",
                        selected
                          ? "border-blue-200 text-blue-700"
                          : "border-slate-200 text-slate-500",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{mode.title}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">{mode.key}</div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded px-2 py-1 text-[10px] font-bold",
                      selected ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {selected ? "当前选择" : mode.status}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">{mode.desc}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  <span className="font-bold text-slate-800">选择逻辑：</span>
                  {mode.logic}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-[11px] leading-5 text-indigo-700">
          <SelectedModeIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            当前 Agent 使用 <b>{selectedMode.title}</b>：{selectedMode.desc}
          </span>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-white px-5 py-4 xl:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h4 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <Waypoints className="h-5 w-5 text-blue-600" />
                Workflow 模板配置
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                对账治理 Agent Runtime 默认绑定「收入回款对账治理」模板（9 节点纵向 DAG）；画布为只读预览，编辑与发布请前往 Workflow 管理。
              </p>
            </div>
            <button
              type="button"
              onClick={openWorkflowEditor}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
            >
              在 Workflow 管理中编辑
            </button>
            <div className="flex flex-wrap items-center gap-2">
              {LOOP_STAGES.map((stage) => (
                <span
                  key={stage}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600"
                >
                  {stage}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {templates.map((template) => {
              const selected = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch({ workflowTemplateId: template.id })}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-all",
                    selected
                      ? "border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-100"
                      : "border-slate-200 bg-slate-50",
                    !disabled && "hover:border-blue-300 hover:bg-white",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">{template.name}</div>
                      <div className="mt-1 text-[11px] font-semibold text-slate-500">
                        {template.owner} / {template.latestVersion}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-bold",
                        selected ? "bg-blue-600 text-white" : "bg-white text-slate-500",
                      )}
                    >
                      {selected ? "当前模板" : "已发布"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{template.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-50/70 p-4 xl:p-5">
          <div className="overflow-x-auto">
            <WorkflowPreviewCanvas
              templateId={selectedTemplate}
              templateName={findWorkflowListItem(templates, selectedTemplate).name}
              templateVersion={findWorkflowListItem(templates, selectedTemplate).latestVersion}
            />
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:p-6">
        <div className="mb-5">
          <h4 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Network className="h-5 w-5 text-blue-600" />
            Runtime 架构拓扑
          </h4>
        </div>

        <div className="flex flex-col items-stretch gap-3">
          <ArchBox
            tone="slate"
            icon={Activity}
            title="差异触发源"
            subtitle="帆软差异清单 / 月结批次 / API 调用"
          />
          <ArrowDown className="h-4 w-4 self-center text-slate-400" />

          <div className="flex w-full flex-col items-center gap-3 lg:flex-row lg:items-stretch">
            <div className="flex-1">
              <ArchBox
                tone="blue"
                icon={Bot}
                title={form.name || "对账治理 Agent"}
                subtitle={`Agent Runtime / Workflow: ${findWorkflowListItem(templates, selectedTemplate).name}`}
                accent="ORCHESTRATOR"
                large
              />
            </div>
            <div className="flex items-center text-slate-400">→</div>
            <div className="flex-1">
              <ArchBox
                tone="amber"
                icon={Sparkles}
                title={gateway?.model ?? "未配置模型"}
                subtitle={
                  gateway
                    ? `Model Gateway / provider=${gateway.provider}`
                    : "Model Gateway / 未配置 Key"
                }
                accent="MODEL GATEWAY"
              />
            </div>
          </div>

          <ArrowDown className="h-4 w-4 self-center text-slate-400" />

          <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
            <ArchBox
              tone="amber"
              icon={Layers}
              title="Skill Hub"
              subtitle={`${form.selectedSkillCodes.length} 个已挂载 Skill`}
              compact
            />
            <ArchBox
              tone="cyan"
              icon={Wrench}
              title="Tool Registry"
              subtitle={`${form.selectedToolNames.length} 个已装载 Tool`}
              compact
            />
            <ArchBox
              tone="emerald"
              icon={Database}
              title="Connector Hub"
              subtitle="excel_import / rule_engine / template_engine"
              compact
            />
            <ArchBox
              tone="indigo"
              icon={Waypoints}
              title="Trace & Eval"
              subtitle="Run / Step 全链路落库"
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchBox({
  icon: Icon,
  title,
  subtitle,
  tone,
  accent,
  large,
  compact,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  tone: "slate" | "blue" | "amber" | "emerald" | "cyan" | "indigo";
  accent?: string;
  large?: boolean;
  compact?: boolean;
}) {
  const toneMap: Record<string, { border: string; bg: string; text: string; chip: string }> = {
    slate: {
      border: "border-slate-300",
      bg: "bg-white",
      text: "text-slate-700",
      chip: "bg-slate-100 text-slate-600",
    },
    blue: {
      border: "border-blue-600",
      bg: "bg-blue-600",
      text: "text-white",
      chip: "bg-blue-800/50 text-blue-100",
    },
    amber: {
      border: "border-amber-300",
      bg: "bg-amber-50",
      text: "text-amber-900",
      chip: "bg-amber-100 text-amber-700",
    },
    emerald: {
      border: "border-emerald-300",
      bg: "bg-emerald-50",
      text: "text-emerald-900",
      chip: "bg-emerald-100 text-emerald-700",
    },
    cyan: {
      border: "border-cyan-300",
      bg: "bg-cyan-50",
      text: "text-cyan-900",
      chip: "bg-cyan-100 text-cyan-700",
    },
    indigo: {
      border: "border-indigo-300",
      bg: "bg-indigo-50",
      text: "text-indigo-900",
      chip: "bg-indigo-100 text-indigo-700",
    },
  };
  const cls = toneMap[tone];
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-lg border-2 shadow-sm",
        cls.border,
        cls.bg,
        cls.text,
        large ? "px-8 py-5" : compact ? "px-3 py-3" : "px-6 py-4",
      )}
    >
      <Icon className={cn(large ? "h-7 w-7" : "h-5 w-5")} />
      <div className={cn("text-center font-bold", large ? "text-lg" : compact ? "text-sm" : "text-base")}>
        {title}
      </div>
      <div className={cn("text-center text-[10px] opacity-80", large && "text-xs")}>
        {subtitle}
      </div>
      {accent && (
        <span
          className={cn(
            "mt-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest",
            cls.chip,
          )}
        >
          {accent}
        </span>
      )}
    </div>
  );
}

