import { useEffect, useState } from "react";
import {
  Copy,
  Loader2,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "../../lib/utils.ts";
import { resetWorkflowDataSource, workflowApi } from "../../lib/workflowApi.ts";
import type { WorkflowCategory, WorkflowListItem, WorkflowStatus } from "../../types/workflow.ts";
import { WorkflowEditorPage } from "./WorkflowEditorPage.tsx";
import { ConfirmDialog } from "./workflows/ConfirmDialog.tsx";
import { CreateWorkflowModal } from "./workflows/CreateWorkflowModal.tsx";

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-amber-50 text-amber-800 border-amber-200",
  archived: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  published: "已发布",
  draft: "草稿",
  archived: "已归档",
};

export function WorkflowsView() {
  const [items, setItems] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [editorId, setEditorId] = useState<string | null>(() => {
    const pending = sessionStorage.getItem("workflow-editor-id");
    if (pending) {
      sessionStorage.removeItem("workflow-editor-id");
      return pending;
    }
    return null;
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await workflowApi.list({
          q: q || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        });
        if (cancelled) return;
        setItems(list);
      } catch (e) {
        if (cancelled) return;
        setItems([]);
        setError(
          e instanceof Error
            ? e.message
            : "无法加载模板列表，请确认已运行 npm run dev（API 端口 9002）。",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [q, statusFilter, listRefreshKey]);

  const reloadList = () => setListRefreshKey((k) => k + 1);

  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent<{ workflowId?: string }>).detail?.workflowId;
      if (id) setEditorId(id);
    };
    window.addEventListener("workflow-open-editor", open);
    return () => window.removeEventListener("workflow-open-editor", open);
  }, []);

  if (editorId) {
    return <WorkflowEditorPage templateId={editorId} onBack={() => setEditorId(null)} />;
  }

  const handleCreateSubmit = async (payload: {
    name: string;
    description: string;
    category: WorkflowCategory;
  }) => {
    setCreateSubmitting(true);
    setError(null);
    try {
      const record = await workflowApi.create({
        name: payload.name,
        description: payload.description || undefined,
        category: payload.category,
      });
      setCreateOpen(false);
      setEditorId(record.meta.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleClone = async (id: string, name: string) => {
    try {
      const record = await workflowApi.create({ name: `${name} (副本)`, cloneFrom: id });
      setEditorId(record.meta.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "复制失败");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setError(null);
    try {
      await workflowApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      reloadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handlePublish = async (id: string, versionId: string) => {
    try {
      await workflowApi.publish(id, { versionId });
      reloadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await workflowApi.unpublish(id);
      reloadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "下架失败");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Network className="h-5 w-5 text-blue-600" />
            Workflow 管理
          </h2>
          <p className="mt-1 text-sm text-slate-500">DAG 模板配置、版本与发布（可视化画布编辑器）。</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="ui-btn-primary"
        >
          <Plus className="h-4 w-4" />
          新建模板
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              resetWorkflowDataSource();
              reloadList();
            }}
            className="ui-btn-secondary px-2.5 py-1 text-xs text-rose-700 border-rose-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索模板名称..."
            className="ui-input py-2 pl-9 pr-3"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="ui-input w-auto px-3 py-2"
        >
          <option value="all">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已归档</option>
        </select>
        <button
          type="button"
          onClick={reloadList}
          className="ui-btn-secondary px-3 py-2 text-slate-600"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      <div className="ui-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-500">暂无模板</p>
            <p className="mt-1 text-xs text-slate-400">
              {error
                ? "请先启动后端 API（npm run dev）后点击刷新"
                : "点击“新建模板”创建，或点击刷新加载预设模板"}
            </p>
            <button
              type="button"
              onClick={reloadList}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              刷新列表
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">模板</th>
                <th className="px-4 py-3">分类</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">版本</th>
                <th className="px-4 py-3">节点</th>
                <th className="px-4 py-3">负责人</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 transition hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditorId(item.id)}
                      className="text-left font-semibold text-slate-900 hover:text-blue-600"
                    >
                      {item.name}
                    </button>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{item.description}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.category === "data_quality" ? "对账治理" : "通用"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", STATUS_STYLES[item.status])}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{item.latestVersion}</td>
                  <td className="px-4 py-3 text-slate-600">{item.nodeCount}</td>
                  <td className="px-4 py-3 text-slate-600">{item.owner}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" title="编辑" onClick={() => setEditorId(item.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" title="复制" onClick={() => void handleClone(item.id, item.name)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
                        <Copy className="h-4 w-4" />
                      </button>
                      {item.status !== "published" && (
                        <button type="button" title="发布" onClick={() => void handlePublish(item.id, item.latestVersionId)} className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
                          <Upload className="h-4 w-4" />
                        </button>
                      )}
                      {item.status === "published" && (
                        <button type="button" title="下架" onClick={() => void handleUnpublish(item.id)} className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50">
                          下架
                        </button>
                      )}
                      <button type="button" title="删除" onClick={() => setDeleteTarget({ id: item.id, name: item.name })} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateWorkflowModal
        open={createOpen}
        submitting={createSubmitting}
        onClose={() => !createSubmitting && setCreateOpen(false)}
        onSubmit={(payload) => void handleCreateSubmit(payload)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        variant="danger"
        title="删除模板"
        description={deleteTarget ? `确定删除“${deleteTarget.name}”？此操作不可恢复。` : undefined}
        confirmLabel="删除"
        submitting={deleteSubmitting}
        onClose={() => !deleteSubmitting && setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
}
