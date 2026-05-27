import React from "react";
import { cn } from "@/src/lib/utils.ts";
import { DEFAULT_SKILL_POLICY } from "@/src/api/skills.ts";

export type SkillPolicy = typeof DEFAULT_SKILL_POLICY & Record<string, unknown>;

type AccessMode = "deny" | "allow_with_confirm" | "allow";
type ToolsMode = "inherit" | "allowlist" | "denylist";
type SideEffectLevel = "none" | "low" | "medium" | "high" | "critical";

const ACCESS_MODES: { value: AccessMode; label: string }[] = [
  { value: "deny", label: "禁止" },
  { value: "allow_with_confirm", label: "允许（需强确认）" },
  { value: "allow", label: "允许" },
];

const SIDE_EFFECT_LEVELS: { value: SideEffectLevel; label: string }[] = [
  { value: "none", label: "无" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "critical", label: "严重" },
];

function linesToList(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToLines(list?: string[]): string {
  return (list ?? []).join("\n");
}

function patchPolicy(
  policy: SkillPolicy,
  patch: Partial<SkillPolicy>,
): SkillPolicy {
  return { ...policy, ...patch };
}

function patchNested(
  policy: SkillPolicy,
  key: "network" | "filesystem_write" | "scripts" | "tools",
  patch: Record<string, unknown>,
): SkillPolicy {
  const current = (policy[key] as Record<string, unknown>) ?? {};
  return { ...policy, [key]: { ...current, ...patch } };
}

interface Props {
  policy: SkillPolicy;
  pathsJson: string[];
  autoInvoke: boolean;
  requireConfirm: boolean;
  contextMode: string;
  onPolicyChange: (policy: SkillPolicy) => void;
  onPathsChange: (paths: string[]) => void;
  onAutoInvokeChange: (v: boolean) => void;
  onRequireConfirmChange: (v: boolean) => void;
  onContextModeChange: (v: string) => void;
  disabled?: boolean;
}

export function SkillPolicyEditor({
  policy,
  pathsJson,
  autoInvoke,
  requireConfirm,
  contextMode,
  onPolicyChange,
  onPathsChange,
  onAutoInvokeChange,
  onRequireConfirmChange,
  onContextModeChange,
  disabled,
}: Props) {
  const network = (policy.network ?? DEFAULT_SKILL_POLICY.network) as {
    mode?: AccessMode;
    allowlist?: string[];
  };
  const fsWrite = (policy.filesystem_write ?? DEFAULT_SKILL_POLICY.filesystem_write) as {
    mode?: AccessMode;
    paths?: string[];
  };
  const scripts = (policy.scripts ?? DEFAULT_SKILL_POLICY.scripts) as {
    mode?: AccessMode;
    sandbox?: string;
  };
  const tools = (policy.tools ?? DEFAULT_SKILL_POLICY.tools) as {
    mode?: ToolsMode;
    allowlist?: string[];
    denylist?: string[];
  };

  return (
    <div className="space-y-5">
      <section className="ui-card p-4">
        <h4 className="ui-panel-title mb-3">全局执行策略</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="ui-label">副作用等级</span>
            <select
              className="ui-input mt-1 w-full"
              disabled={disabled}
              value={(policy.side_effect_level as string) ?? "medium"}
              onChange={(e) =>
                onPolicyChange(patchPolicy(policy, { side_effect_level: e.target.value }))
              }
            >
              {SIDE_EFFECT_LEVELS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="ui-label">执行上下文</span>
            <select
              className="ui-input mt-1 w-full"
              disabled={disabled}
              value={contextMode}
              onChange={(e) => onContextModeChange(e.target.value)}
            >
              <option value="inline">inline（注入主会话）</option>
              <option value="fork">fork（子 Agent 隔离）</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={disabled}
              checked={autoInvoke}
              onChange={(e) => onAutoInvokeChange(e.target.checked)}
            />
            允许模型自动触发
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={disabled}
              checked={requireConfirm}
              onChange={(e) => onRequireConfirmChange(e.target.checked)}
            />
            启用强确认总开关
          </label>
        </div>
      </section>

      <PolicySection title="网络访问 (network)">
        <ModeSelect
          disabled={disabled}
          value={network.mode ?? "allow_with_confirm"}
          onChange={(mode) => onPolicyChange(patchNested(policy, "network", { mode }))}
        />
        <ListField
          label="域名白名单（每行一个，空=不限制）"
          disabled={disabled}
          value={listToLines(network.allowlist)}
          onChange={(text) =>
            onPolicyChange(patchNested(policy, "network", { allowlist: linesToList(text) }))
          }
        />
      </PolicySection>

      <PolicySection title="写文件 (filesystem_write)">
        <ModeSelect
          disabled={disabled}
          value={fsWrite.mode ?? "allow_with_confirm"}
          onChange={(mode) => onPolicyChange(patchNested(policy, "filesystem_write", { mode }))}
        />
        <ListField
          label="允许写入路径 glob（每行一个）"
          disabled={disabled}
          value={listToLines(fsWrite.paths)}
          onChange={(text) =>
            onPolicyChange(patchNested(policy, "filesystem_write", { paths: linesToList(text) }))
          }
        />
      </PolicySection>

      <PolicySection title="脚本执行 (scripts)">
        <ModeSelect
          disabled={disabled}
          value={scripts.mode ?? "allow_with_confirm"}
          onChange={(mode) => onPolicyChange(patchNested(policy, "scripts", { mode }))}
        />
        <label className="mt-3 block">
          <span className="ui-label">沙箱级别</span>
          <select
            className="ui-input mt-1 w-full"
            disabled={disabled}
            value={scripts.sandbox ?? "strict"}
            onChange={(e) =>
              onPolicyChange(patchNested(policy, "scripts", { sandbox: e.target.value }))
            }
          >
            <option value="strict">strict（严格）</option>
            <option value="relaxed">relaxed（宽松）</option>
          </select>
        </label>
      </PolicySection>

      <PolicySection title="Tool 调用 (tools)">
        <label className="block">
          <span className="ui-label">模式</span>
          <select
            className="ui-input mt-1 w-full"
            disabled={disabled}
            value={tools.mode ?? "inherit"}
            onChange={(e) =>
              onPolicyChange(patchNested(policy, "tools", { mode: e.target.value }))
            }
          >
            <option value="inherit">inherit（继承 Agent）</option>
            <option value="allowlist">allowlist（白名单）</option>
            <option value="denylist">denylist（黑名单）</option>
          </select>
        </label>
        {tools.mode === "allowlist" && (
          <ListField
            label="Tool 白名单（每行一个 tool key）"
            disabled={disabled}
            value={listToLines(tools.allowlist)}
            onChange={(text) =>
              onPolicyChange(patchNested(policy, "tools", { allowlist: linesToList(text) }))
            }
          />
        )}
        {tools.mode === "denylist" && (
          <ListField
            label="Tool 黑名单（每行一个 tool key）"
            disabled={disabled}
            value={listToLines(tools.denylist)}
            onChange={(text) =>
              onPolicyChange(patchNested(policy, "tools", { denylist: linesToList(text) }))
            }
          />
        )}
      </PolicySection>

      <section className="ui-card p-4">
        <h4 className="ui-panel-title mb-2">Paths 路由切片</h4>
        <p className="mb-3 text-xs text-slate-500">
          工作区文件 glob 命中时自动触发 Skill（P3 启用完整路由，此处可先配置）
        </p>
        <textarea
          className="ui-input min-h-24 w-full font-mono text-sm"
          disabled={disabled}
          placeholder={"apps/web/**\ndeploy/**"}
          value={listToLines(pathsJson)}
          onChange={(e) => onPathsChange(linesToList(e.target.value))}
        />
      </section>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ui-card p-4">
      <h4 className="ui-panel-title mb-3">{title}</h4>
      {children}
    </section>
  );
}

function ModeSelect({
  value,
  onChange,
  disabled,
}: {
  value: AccessMode;
  onChange: (v: AccessMode) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="ui-label">访问模式</span>
      <select
        className="ui-input mt-1 w-full"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value as AccessMode)}
      >
        {ACCESS_MODES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ListField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("mt-3 block")}>
      <span className="ui-label">{label}</span>
      <textarea
        className="ui-input mt-1 min-h-20 w-full font-mono text-sm"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function policySummary(policy?: Record<string, unknown>): string {
  if (!policy) return "默认策略";
  const net = (policy.network as { mode?: string })?.mode ?? "allow_with_confirm";
  const fs = (policy.filesystem_write as { mode?: string })?.mode ?? "allow_with_confirm";
  const level = policy.side_effect_level ?? "medium";
  return `网络:${net} · 写盘:${fs} · 副作用:${level}`;
}
