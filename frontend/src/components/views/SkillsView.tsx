import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileArchive,
  FileText,
  FolderTree,
  Loader2,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Search,
  Settings2,
  Shield,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/src/lib/utils.ts";
import {
  createSkill,
  DEFAULT_SKILL_POLICY,
  deleteSkill,
  exportSkillMarkdown,
  exportSkillZip,
  fetchSkillDetail,
  fetchSkillRegistry,
  importSkillMarkdown,
  publishSkill,
  reloadSkillRegistry,
  updateSkill,
  type SkillDetail,
  type SkillSummary,
  type SkillUpsertForm,
} from "@/src/api/skills.ts";
import {
  policySummary,
  SkillPolicyEditor,
  type SkillPolicy,
} from "@/src/components/views/skills/SkillPolicyEditor.tsx";
import {
  UiBadge,
  UiButton,
  UiPanelCard,
  UiSectionHeading,
  UiTabs,
  type TabItem,
} from "@/src/components/ui/primitives.tsx";
import { MarkdownPreview } from "@/src/components/ui/MarkdownPreview.tsx";
import { SkillResourceTree } from "@/src/components/views/skills/SkillResourceTree.tsx";
import { SkillRoutePanel } from "@/src/components/views/skills/SkillRoutePanel.tsx";
import { useAuth } from "@/src/auth.tsx";

const emptyForm: SkillUpsertForm = {
  skillCode: "",
  skillName: "",
  description: "",
  category: "general",
  contentMd: "# Skill Instructions\n\nDescribe when and how to use this skill.\n",
  policyJson: DEFAULT_SKILL_POLICY,
  pathsJson: [],
  autoInvoke: true,
  requireConfirm: true,
  contextMode: "inline",
  owner: "platform",
};

const FORM_TABS: TabItem[] = [
  { id: "basic", label: "基础信息" },
  { id: "policy", label: "执行策略" },
  { id: "content", label: "指令正文" },
];

const DETAIL_TABS: TabItem[] = [
  { id: "overview", label: "概览", icon: <FileText className="h-4 w-4" /> },
  { id: "instructions", label: "指令", icon: <Brain className="h-4 w-4" /> },
  { id: "resources", label: "资源", icon: <FolderTree className="h-4 w-4" /> },
  { id: "policy", label: "策略", icon: <Shield className="h-4 w-4" /> },
  { id: "route", label: "路由仿真", icon: <Route className="h-4 w-4" /> },
];

const IMPORT_HINT = `支持 Agent Skills 标准包：单文件 SKILL.md，或含 scripts/references 的 .zip。
SKILL.md 必须以 YAML frontmatter 开头（---），至少包含 name；description 用于路由匹配。
可选：paths、metadata.execution_policy、disable-model-invocation、context。`;

export function SkillsView() {
  const { accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [importHintOpen, setImportHintOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formTab, setFormTab] = useState("basic");
  const [form, setForm] = useState<SkillUpsertForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [instructionView, setInstructionView] = useState<"preview" | "source">("preview");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSkillRegistry(accessToken);
      setSkills(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setInstructionView("preview");
    setDetailLoading(true);
    fetchSkillDetail(accessToken, selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [accessToken, selectedId]);

  const selectSkill = (id: string) => {
    setSelectedId(id);
    setDetailTab("overview");
  };

  const closeDrawer = () => setSelectedId(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (statusFilter === "published" && s.publishStatus !== "published") return false;
      if (statusFilter === "draft" && s.publishStatus === "published") return false;
      if (!q) return true;
      return (
        s.skillName.toLowerCase().includes(q) ||
        s.skillCode.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [skills, query, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: skills.length,
      published: skills.filter((s) => s.publishStatus === "published").length,
      draft: skills.filter((s) => s.publishStatus !== "published").length,
    }),
    [skills],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormTab("basic");
    setFormOpen(true);
  };

  const openEdit = (row: SkillDetail) => {
    setEditingId(row.id);
    setForm({
      skillCode: row.skillCode,
      skillName: row.skillName,
      description: row.description,
      category: row.category,
      tags: row.tags,
      contentMd: row.contentMd,
      policyJson: (row.policyJson as SkillPolicy) ?? DEFAULT_SKILL_POLICY,
      pathsJson: row.pathsJson ?? [],
      autoInvoke: row.autoInvoke,
      requireConfirm: row.requireConfirm,
      contextMode: row.contextMode ?? "inline",
      owner: row.owner,
      remark: row.remark,
    });
    setFormTab("basic");
    setFormOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body: SkillUpsertForm = {
        ...form,
        policyJson: {
          ...(form.policyJson ?? DEFAULT_SKILL_POLICY),
          auto_invoke: form.autoInvoke,
          context: form.contextMode,
        },
      };
      if (editingId) {
        await updateSkill(accessToken, editingId, body);
      } else {
        const id = await createSkill(accessToken, body);
        selectSkill(id);
      }
      setFormOpen(false);
      await load();
      if (editingId && selectedId === editingId) {
        const refreshed = await fetchSkillDetail(accessToken, editingId);
        setDetail(refreshed);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("确认删除该 Skill？")) return;
    await deleteSkill(accessToken, id);
    if (selectedId === id) closeDrawer();
    await load();
  };

  const publish = async (id: string) => {
    await publishSkill(accessToken, id);
    await reloadSkillRegistry(accessToken);
    await load();
    const refreshed = await fetchSkillDetail(accessToken, id);
    setDetail(refreshed);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setError(null);
    try {
      const imported = await importSkillMarkdown(accessToken, file);
      selectSkill(imported.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMd = async (id: string, skillCode: string) => {
    try {
      const blob = await exportSkillMarkdown(accessToken, id);
      downloadBlob(blob, `${skillCode}-SKILL.md`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    }
  };

  const handleExportZip = async (id: string, skillCode: string) => {
    try {
      const blob = await exportSkillZip(accessToken, id);
      downloadBlob(blob, `${skillCode}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    }
  };

  return (
    <div className="ui-page-enter h-full overflow-auto p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <UiPanelCard className="!p-0">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Skill 管理</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  点击列表项在右侧抽屉查看详情；支持 SKILL.md / ZIP 导入与路由仿真。
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  共 {metrics.total} 个 · 已发布 {metrics.published} · 草稿 {metrics.draft}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,.zip,application/zip,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImport(file);
                    e.target.value = "";
                  }}
                />
                <UiButton
                  variant="secondary"
                  disabled={importing}
                  icon={
                    importing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )
                  }
                  onClick={() => fileInputRef.current?.click()}
                >
                  导入
                </UiButton>
                <UiButton variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => void load()}>
                  刷新
                </UiButton>
                <UiButton variant="primary" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                  新增 Skill
                </UiButton>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setImportHintOpen((v) => !v)}
              className="mt-4 flex w-full items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-left text-xs text-indigo-900 transition hover:bg-indigo-50"
            >
              <Upload className="h-4 w-4 shrink-0 text-indigo-600" />
              <span className="flex-1 font-medium">导入格式说明（Agent Skills 标准）</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", importHintOpen && "rotate-180")}
              />
            </button>
            {importHintOpen && (
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 font-sans text-xs leading-5 text-slate-600">
                {IMPORT_HINT}
              </pre>
            )}

            {error && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 pb-6">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="ui-stat-card !p-4">
                <p className="text-xs font-medium text-slate-500">全部 Skill</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.total}</p>
              </div>
              <div className="ui-stat-card !p-4">
                <p className="text-xs font-medium text-slate-500">已发布</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{metrics.published}</p>
              </div>
              <div className="ui-stat-card !p-4">
                <p className="text-xs font-medium text-slate-500">草稿</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">{metrics.draft}</p>
              </div>
            </div>

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "all", label: "全部" },
                    { id: "published", label: "已发布" },
                    { id: "draft", label: "草稿" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                      statusFilter === item.id
                        ? "bg-indigo-600 text-white ring-indigo-600 shadow-sm"
                        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索名称、Code、描述…"
                  className="ui-input w-full min-w-[240px] pl-9 lg:w-72"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
                暂无 Skill，可导入 SKILL.md 或新增
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((skill) => {
                  const active = selectedId === skill.id;
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => selectSkill(skill.id)}
                      className={cn("ui-catalog-row group", active && "ui-catalog-row-active")}
                    >
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/20",
                        )}
                      >
                        <Brain className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-900">{skill.skillName}</h3>
                          <UiBadge type={skill.publishStatus === "published" ? "success" : "warning"}>
                            {skill.publishStatus === "published" ? "已发布" : "草稿"}
                          </UiBadge>
                          {skill.category && <UiBadge type="default">{skill.category}</UiBadge>}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{skill.skillCode}</p>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{skill.description}</p>
                      </div>
                      <span className="hidden text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 sm:inline">
                        查看详情
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-500" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </UiPanelCard>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedId && (
              <>
                <motion.button
                  type="button"
                  aria-label="关闭 Skill 详情"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="ui-drawer-mask fixed inset-0 z-[80]"
                  onClick={closeDrawer}
                />
                <motion.aside
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="skill-detail-title"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                  className="ui-drawer-panel fixed inset-y-0 right-0 z-[81] flex w-full max-w-xl flex-col sm:max-w-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {detailLoading ? (
                    <div className="flex flex-1 items-center justify-center text-slate-400">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载详情…
                    </div>
                  ) : !detail ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 text-slate-400">
                      <p className="text-sm">加载失败或 Skill 不存在</p>
                      <UiButton variant="secondary" className="mt-3" onClick={closeDrawer}>
                        关闭
                      </UiButton>
                    </div>
                  ) : (
                    <>
                      <div className="ui-drawer-header shrink-0 px-5 pb-0 pt-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                            <Brain className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 id="skill-detail-title" className="truncate text-lg font-bold text-slate-900">
                                {detail.skillName}
                              </h3>
                              <button
                                type="button"
                                onClick={closeDrawer}
                                className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{detail.skillCode}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <UiBadge type="default">v{detail.version ?? "1.0.0"}</UiBadge>
                              <UiBadge type={detail.autoInvoke ? "success" : "default"}>
                                {detail.autoInvoke ? "可自动触发" : "仅手动"}
                              </UiBadge>
                              <UiBadge type={detail.requireConfirm ? "warning" : "default"}>
                                {detail.requireConfirm ? "强确认" : "无确认"}
                              </UiBadge>
                              <UiBadge type={detail.isEnabled ? "success" : "warning"}>
                                {detail.publishStatus === "published" ? "已发布" : "草稿"}
                              </UiBadge>
                            </div>
                          </div>
                        </div>
                        {detail.description && (
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                            {detail.description}
                          </p>
                        )}
                        <UiTabs
                          tabs={DETAIL_TABS}
                          activeTab={detailTab}
                          onChange={setDetailTab}
                          className="mb-0 mt-3 px-0 [&_button]:px-4 [&_button]:py-2.5 [&_button]:text-xs"
                        />
                      </div>

                      <div className="scrollbar-default min-h-0 flex-1 overflow-y-auto px-5 py-4">
                        {detailTab === "overview" && (
                          <div className="space-y-4">
                            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                              <UiSectionHeading className="mb-2">路由摘要</UiSectionHeading>
                              <p className="leading-relaxed">{policySummary(detail.policyJson)}</p>
                              {detail.pathsJson && detail.pathsJson.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {detail.pathsJson.map((p) => (
                                    <span
                                      key={p}
                                      className="rounded-md bg-white px-2 py-0.5 font-mono text-[10px] text-slate-600 ring-1 ring-slate-200"
                                    >
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {detailTab === "instructions" && (
                          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                              <span className="text-xs font-semibold text-slate-500">SKILL.md</span>
                              <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-medium">
                                <button
                                  type="button"
                                  onClick={() => setInstructionView("preview")}
                                  className={cn(
                                    "rounded-md px-2.5 py-1 transition-colors",
                                    instructionView === "preview"
                                      ? "bg-white text-indigo-600 shadow-sm"
                                      : "text-slate-500",
                                  )}
                                >
                                  预览
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInstructionView("source")}
                                  className={cn(
                                    "rounded-md px-2.5 py-1 transition-colors",
                                    instructionView === "source"
                                      ? "bg-white text-indigo-600 shadow-sm"
                                      : "text-slate-500",
                                  )}
                                >
                                  源码
                                </button>
                              </div>
                            </div>
                            <div className="scrollbar-default max-h-[min(52vh,480px)] overflow-auto p-4">
                              {instructionView === "preview" ? (
                                <MarkdownPreview content={detail.contentMd ?? ""} />
                              ) : (
                                <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-slate-700">
                                  {detail.contentMd || "（暂无指令正文）"}
                                </pre>
                              )}
                            </div>
                          </div>
                        )}

                        {detailTab === "resources" && (
                          <SkillResourceTree resources={detail.resources ?? []} />
                        )}

                        {detailTab === "route" && <SkillRoutePanel />}

                        {detailTab === "policy" && (
                          <div className="space-y-4">
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-950">
                              {policySummary(detail.policyJson)}
                            </div>
                            <pre className="scrollbar-default max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] leading-5 text-slate-100">
                              {JSON.stringify(detail.policyJson ?? DEFAULT_SKILL_POLICY, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-sm">
                        <UiButton
                          variant="secondary"
                          icon={<FileText className="h-4 w-4" />}
                          onClick={() => void handleExportMd(detail.id, detail.skillCode)}
                        >
                          导出 MD
                        </UiButton>
                        <UiButton
                          variant="secondary"
                          icon={<FileArchive className="h-4 w-4" />}
                          onClick={() => void handleExportZip(detail.id, detail.skillCode)}
                        >
                          导出 ZIP
                        </UiButton>
                        <UiButton
                          variant="secondary"
                          icon={<Settings2 className="h-4 w-4" />}
                          onClick={() => openEdit(detail)}
                        >
                          编辑
                        </UiButton>
                        {detail.publishStatus !== "published" && (
                          <UiButton
                            variant="primary"
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            onClick={() => void publish(detail.id)}
                          >
                            发布
                          </UiButton>
                        )}
                        <UiButton
                          variant="danger"
                          className="ml-auto"
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={() => void remove(detail.id)}
                        >
                          删除
                        </UiButton>
                      </div>
                    </>
                  )}
                </motion.aside>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {formOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ui-modal-mask fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
                role="dialog"
                aria-modal="true"
              >
                <button
                  type="button"
                  aria-label="关闭"
                  className="absolute inset-0"
                  onClick={() => setFormOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 10 }}
                  className="ui-modal-enter relative z-10 flex max-h-[min(90vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h3 className="text-lg font-bold text-slate-900">{editingId ? "编辑 Skill" : "新增 Skill"}</h3>
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <UiTabs tabs={FORM_TABS} activeTab={formTab} onChange={setFormTab} className="mb-0 shrink-0 px-4" />
                  <div className="scrollbar-default min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    {formTab === "basic" && (
                      <div className="grid gap-3">
                        <label className="block">
                          <span className="ui-label">Skill Code</span>
                          <input
                            className="ui-input mt-1 w-full font-mono"
                            value={form.skillCode}
                            disabled={!!editingId}
                            onChange={(e) => setForm({ ...form, skillCode: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="ui-label">名称</span>
                          <input
                            className="ui-input mt-1 w-full"
                            value={form.skillName}
                            onChange={(e) => setForm({ ...form, skillName: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="ui-label">Description（路由用，必填）</span>
                          <textarea
                            className="ui-input mt-1 min-h-24 w-full"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                          />
                        </label>
                        <label className="block">
                          <span className="ui-label">分类</span>
                          <input
                            className="ui-input mt-1 w-full"
                            value={form.category ?? ""}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                          />
                        </label>
                      </div>
                    )}
                    {formTab === "policy" && (
                      <SkillPolicyEditor
                        policy={(form.policyJson as SkillPolicy) ?? DEFAULT_SKILL_POLICY}
                        pathsJson={form.pathsJson ?? []}
                        autoInvoke={form.autoInvoke ?? true}
                        requireConfirm={form.requireConfirm ?? true}
                        contextMode={form.contextMode ?? "inline"}
                        onPolicyChange={(policy) => setForm({ ...form, policyJson: policy })}
                        onPathsChange={(pathsJson) => setForm({ ...form, pathsJson })}
                        onAutoInvokeChange={(autoInvoke) => setForm({ ...form, autoInvoke })}
                        onRequireConfirmChange={(requireConfirm) => setForm({ ...form, requireConfirm })}
                        onContextModeChange={(contextMode) => setForm({ ...form, contextMode })}
                      />
                    )}
                    {formTab === "content" && (
                      <label className="block">
                        <span className="ui-label">正文 Markdown</span>
                        <textarea
                          className="ui-input scrollbar-default mt-1 min-h-[360px] w-full font-mono text-sm"
                          value={form.contentMd}
                          onChange={(e) => setForm({ ...form, contentMd: e.target.value })}
                        />
                      </label>
                    )}
                  </div>
                  <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
                    <UiButton variant="secondary" onClick={() => setFormOpen(false)}>
                      取消
                    </UiButton>
                    <UiButton
                      variant="primary"
                      disabled={saving}
                      icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      onClick={() => void save()}
                    >
                      保存
                    </UiButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
