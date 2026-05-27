import React, { useState } from "react";
import { Loader2, Play, Sparkles } from "lucide-react";
import { cn } from "@/src/lib/utils.ts";
import { testSkillRoute, type SkillRouteTestResult } from "@/src/api/skills.ts";
import { UiButton } from "@/src/components/ui/primitives.tsx";
import { useAuth } from "@/src/auth.tsx";

export function SkillRoutePanel({ defaultAgentId }: { defaultAgentId?: string }) {
  const { accessToken } = useAuth();
  const [inputText, setInputText] = useState("帮我把这份 Word 文档转成 PDF");
  const [agentId, setAgentId] = useState(defaultAgentId ?? "document");
  const [workspacePaths, setWorkspacePaths] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SkillRouteTestResult | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const paths = workspacePaths
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const data = await testSkillRoute(accessToken, {
        inputText,
        agentId: agentId.trim() || undefined,
        workspacePaths: paths.length > 0 ? paths : undefined,
        topK: 8,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "路由仿真失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-slate-500">
        模拟用户输入与 workspace 路径，调用向量检索 + 规则过滤，查看 Top-K 候选 Skill 及最终选中项（不执行 Skill）。
      </p>
      <label className="block">
        <span className="ui-label">用户输入</span>
        <textarea
          className="ui-input mt-1 min-h-20 w-full text-sm"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="例如：生成现金流管理层简报"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="ui-label">Agent ID（可选）</span>
          <input
            className="ui-input mt-1 w-full font-mono text-xs"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="document / cashflow"
          />
        </label>
        <label className="block">
          <span className="ui-label">Top-K</span>
          <input className="ui-input mt-1 w-full" value="8" disabled />
        </label>
      </div>
      <label className="block">
        <span className="ui-label">Workspace 路径（每行一个 glob，可选）</span>
        <textarea
          className="ui-input mt-1 w-full font-mono text-xs"
          rows={3}
          value={workspacePaths}
          onChange={(e) => setWorkspacePaths(e.target.value)}
          placeholder={"report.docx\n**/*.xlsx"}
        />
      </label>
      <UiButton
        variant="primary"
        icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        onClick={() => void run()}
        disabled={loading || !inputText.trim()}
      >
        运行路由仿真
      </UiButton>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs text-emerald-800">选中 Skill</p>
              <p className="font-mono text-sm font-bold text-emerald-950">
                {result.selectedSkillCode ?? "（无匹配）"}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">候选排序</p>
            <div className="space-y-2">
              {(result.candidates ?? []).map((c, i) => (
                <div
                  key={`${c.skillCode}-${i}`}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    result.selectedSkillCode === c.skillCode
                      ? "border-indigo-200 bg-indigo-50/60"
                      : "border-slate-100 bg-white",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-800">{c.skillCode}</span>
                    <span className="text-xs font-medium text-indigo-600">{(c.score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.matchedBy && <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5">{c.matchedBy}</span>}
                    {c.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
