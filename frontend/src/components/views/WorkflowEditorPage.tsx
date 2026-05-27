import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LayoutTemplate,
  Loader2,
  Save,
  ShieldAlert,
  Upload,
} from "lucide-react";
import type { Node } from "@xyflow/react";
import { cn } from "@/src/lib/utils.ts";
import { validateDag } from "@/src/lib/dagValidator.ts";
import { workflowApi } from "@/src/lib/workflowApi.ts";
import type { DagValidationResult, NodeKind, WorkflowGraph, WorkflowTemplateRecord } from "@/src/types/workflow.ts";
import { NodePalette } from "./agents/workflow/editor/NodePalette.tsx";
import { NodeInspector } from "./agents/workflow/editor/NodeInspector.tsx";
import { WorkflowEditorCanvas } from "./agents/workflow/editor/WorkflowEditorCanvas.tsx";
import type { WorkflowNodeData } from "./agents/workflow/WorkflowNode.tsx";

interface Props {
  templateId: string;
  onBack: () => void;
}

export function WorkflowEditorPage({ templateId, onBack }: Props) {
  const [record, setRecord] = useState<WorkflowTemplateRecord | null>(null);
  const [versionId, setVersionId] = useState("");
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [selected, setSelected] = useState<Node<WorkflowNodeData> | null>(null);
  const [validation, setValidation] = useState<DagValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const addNodeRef = useRef<((kind: NodeKind) => void) | null>(null);
  const layoutRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await workflowApi.get(templateId);
      setRecord(r);
      const vid = r.draftVersionId;
      setVersionId(vid);
      const ver = r.versions.find((v) => v.id === vid);
      setGraph(ver?.graph ?? { nodes: [], edges: [] });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentVersion = record?.versions.find((v) => v.id === versionId);

  const runValidate = useCallback(() => {
    if (!graph) return;
    const result = validateDag(graph);
    setValidation(result);
    return result;
  }, [graph]);

  const handleSave = async () => {
    if (!graph || !versionId) return;
    const result = runValidate();
    if (result && !result.valid) {
      setMessage(result.errors[0]?.message ?? "DAG 校验失败");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await workflowApi.saveGraph(templateId, versionId, graph);
      setMessage("已保存");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!versionId || !graph) return;
    const result = runValidate();
    if (result && !result.valid) {
      setMessage("发布前请修复 DAG 错误");
      return;
    }
    setSaving(true);
    try {
      await workflowApi.saveGraph(templateId, versionId, graph);
      await workflowApi.publish(templateId, { versionId });
      setMessage("已发布");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "发布失败");
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setSaving(true);
    try {
      await workflowApi.unpublish(templateId);
      setMessage("已下架");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "下架失败");
    } finally {
      setSaving(false);
    }
  };

  const handleNewVersion = async () => {
    setSaving(true);
    try {
      const v = await workflowApi.createVersion(templateId, {
        changelog: "从当前草稿复制",
        fromVersionId: versionId,
      });
      setVersionId(v.id);
      setGraph(v.graph);
      setMessage(`已创建版本 ${v.version}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "创建版本失败");
    } finally {
      setSaving(false);
    }
  };

  const handleNodePatch = (nodeId: string, patch: Partial<WorkflowNodeData>) => {
    if (!graph) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                title: patch.title ?? n.data.title,
                desc: patch.desc ?? n.data.desc,
                meta: patch.meta ?? n.data.meta,
              },
            }
          : n,
      ),
    });
    if (selected?.id === nodeId) {
      setSelected({ ...selected, data: { ...selected.data, ...patch } });
    }
  };

  if (loading || !record || !graph) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载工作流…
      </div>
    );
  }

  const statusLabel =
    record.meta.status === "published" ? "已发布" : record.meta.status === "draft" ? "草稿" : "已归档";

  return (
    <div className="app-shell flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="ui-btn-secondary h-8 w-8 p-0 text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold text-slate-900">{record.meta.name}</h2>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
              {currentVersion?.version ?? "-"}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                record.meta.status === "published"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800",
              )}
            >
              {statusLabel}
            </span>
          </div>
          <p className="truncate text-[11px] text-slate-500">{record.meta.description}</p>
        </div>
        <select
          value={versionId}
          onChange={(e) => {
            const vid = e.target.value;
            setVersionId(vid);
            const ver = record.versions.find((v) => v.id === vid);
            if (ver) setGraph(ver.graph);
          }}
          className="ui-input w-auto rounded-lg px-2 py-1.5 text-[11px]"
        >
          {record.versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.version} {v.publishedAt ? "(已发布)" : "(草稿)"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void handleNewVersion()}
          className="ui-btn-secondary rounded-lg px-2.5 py-1.5 text-[11px]"
        >
          新版本
        </button>
        <button
          type="button"
          onClick={() => layoutRef.current?.()}
          className="ui-btn-secondary rounded-lg px-2.5 py-1.5 text-[11px]"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          整理布局
        </button>
        <button
          type="button"
          onClick={runValidate}
          className="ui-btn-secondary rounded-lg px-2.5 py-1.5 text-[11px]"
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          校验 DAG
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="ui-btn-primary rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存
        </button>
        {record.meta.status === "published" ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleUnpublish()}
            className="ui-btn-secondary rounded-lg border-rose-200 px-3 py-1.5 text-[11px] text-rose-700 hover:bg-rose-50"
          >
            下架
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handlePublish()}
            className="ui-btn-primary rounded-lg px-3 py-1.5 text-[11px]"
          >
            <Upload className="h-3.5 w-3.5" />
            发布
          </button>
        )}
      </header>

      {message && (
        <div className="shrink-0 border-b border-slate-100 bg-blue-50 px-4 py-1.5 text-[11px] text-blue-800">
          {message}
        </div>
      )}

      {validation && (
        <div
          className={cn(
            "shrink-0 border-b px-4 py-2 text-[11px]",
            validation.valid
              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
              : "border-rose-100 bg-rose-50 text-rose-800",
          )}
        >
          {validation.valid ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> DAG 校验通过
              {validation.warnings.length > 0 && ` (${validation.warnings.length} warnings)`}
            </span>
          ) : (
            validation.errors.map((e) => e.message).join("; ")
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1" key={versionId}>
        <NodePalette onAdd={(kind) => addNodeRef.current?.(kind)} />
        <WorkflowEditorCanvas
          initialGraph={graph}
          onGraphChange={setGraph}
          onSelectionChange={setSelected}
          onAddNodeRef={addNodeRef}
          onLayoutRef={layoutRef}
        />
        <NodeInspector node={selected} onChange={handleNodePatch} />
      </div>
    </div>
  );
}

