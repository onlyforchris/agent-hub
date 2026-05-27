import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Database,
  Edit3,
  FileText,
  Lightbulb,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils.ts";

type KnowledgeType = "业务口径" | "字段解释" | "处理SOP" | "典型案例";
type KnowledgeStatus = "启用" | "草稿" | "停用";

interface KnowledgeItem {
  id: string;
  title: string;
  type: KnowledgeType;
  scenario: string;
  owner: string;
  status: KnowledgeStatus;
  updatedAt: string;
  summary: string;
  content: string;
  tags: string[];
}

type KnowledgeForm = Omit<KnowledgeItem, "id" | "updatedAt">;

const initialItems: KnowledgeItem[] = [
  {
    id: "KB-001",
    title: "同一结算单出现多个 MDM ID 的业务口径",
    type: "业务口径",
    scenario: "收入对账 / MDM ID 异常",
    owner: "财务数据治理组",
    status: "启用",
    updatedAt: "2026-05-18",
    summary: "解释同一结算单关联多个 MDM ID 时的标准判断口径。",
    content: "同一结算单出现多个 MDM ID 通常说明主数据映射在链路中存在不一致。应结合业务日期、历史主数据映射和 DMS 台账综合判断。",
    tags: ["MDM ID", "主数据", "收入对账"],
  },
  {
    id: "KB-002",
    title: "DMS 结算状态与 SAP 过账状态字段解释",
    type: "字段解释",
    scenario: "状态不一致 / 回传异常",
    owner: "财务信息化组",
    status: "启用",
    updatedAt: "2026-05-17",
    summary: "说明 DMS 业务状态与 SAP 财务状态的字段差异。",
    content: "DMS 状态反映业务进度，SAP 状态反映财务凭证处理结果。两者含义不同，报表必须标注来源系统。",
    tags: ["DMS", "SAP", "字段口径"],
  },
];

const typeIconMap: Record<KnowledgeType, React.ElementType> = {
  业务口径: Lightbulb,
  字段解释: Database,
  处理SOP: ShieldCheck,
  典型案例: FileText,
};

const typeStyleMap: Record<KnowledgeType, string> = {
  业务口径: "bg-blue-50 text-blue-700 border-blue-200",
  字段解释: "bg-emerald-50 text-emerald-700 border-emerald-200",
  处理SOP: "bg-amber-50 text-amber-700 border-amber-200",
  典型案例: "bg-purple-50 text-purple-700 border-purple-200",
};

const statusStyleMap: Record<KnowledgeStatus, string> = {
  启用: "bg-emerald-50 text-emerald-700 border-emerald-200",
  草稿: "bg-amber-50 text-amber-700 border-amber-200",
  停用: "bg-slate-50 text-slate-600 border-slate-200",
};

const emptyForm: KnowledgeForm = {
  title: "",
  type: "业务口径",
  scenario: "",
  owner: "",
  status: "草稿",
  summary: "",
  content: "",
  tags: [],
};

function todayLabel() {
  return new Date().toISOString().slice(0, 10);
}

function parseTags(value: string) {
  return value
    .split(/[，,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function KnowledgeBaseView() {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<"全部" | KnowledgeType>("全部");
  const [activeStatus, setActiveStatus] = useState<"全部" | KnowledgeStatus>("全部");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KnowledgeForm>(emptyForm);
  const [tagInput, setTagInput] = useState("");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const keyword = query.trim().toLowerCase();
      const matchesQuery =
        !keyword ||
        item.title.toLowerCase().includes(keyword) ||
        item.scenario.toLowerCase().includes(keyword) ||
        item.summary.toLowerCase().includes(keyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(keyword));
      const matchesType = activeType === "全部" || item.type === activeType;
      const matchesStatus = activeStatus === "全部" || item.status === activeStatus;
      return matchesQuery && matchesType && matchesStatus;
    });
  }, [activeStatus, activeType, items, query]);

  const selected = items.find((x) => x.id === selectedId) ?? filtered[0];

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setTagInput("");
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      type: item.type,
      scenario: item.scenario,
      owner: item.owner,
      status: item.status,
      summary: item.summary,
      content: item.content,
      tags: item.tags,
    });
    setTagInput(item.tags.join(", "));
  };

  const closeEditor = () => {
    setEditingId(null);
    setForm(emptyForm);
    setTagInput("");
  };

  const saveForm = () => {
    const normalized: KnowledgeForm = {
      ...form,
      title: form.title.trim(),
      scenario: form.scenario.trim(),
      owner: form.owner.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      tags: parseTags(tagInput),
    };
    if (!normalized.title || !normalized.summary || !normalized.content) return;

    if (editingId) {
      setItems((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...normalized, updatedAt: todayLabel() } : x)));
      setSelectedId(editingId);
    } else {
      const nextId = `KB-${String(items.length + 1).padStart(3, "0")}`;
      const next: KnowledgeItem = { id: nextId, updatedAt: todayLabel(), ...normalized };
      setItems((prev) => [next, ...prev]);
      setSelectedId(nextId);
    }
    closeEditor();
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId("");
  };

  const editorOpen = editingId !== null || form !== emptyForm;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full overflow-auto bg-slate-50/60 p-6">
      <div className="grid h-full min-h-[760px] gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><BookOpen className="h-5 w-5 text-blue-600" />知识库管理</h2>
                <p className="mt-1 text-xs text-slate-500">维护业务口径、字段解释、处理 SOP 和典型案例。</p>
              </div>
              <button onClick={startCreate} className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />新增知识</button>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题、场景、标签" className="h-9 w-full rounded border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400" />
            </div>
          </div>

          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
            {filtered.map((item) => {
              const Icon = typeIconMap[item.type];
              return (
                <button key={item.id} onClick={() => setSelectedId(item.id)} className={cn("flex w-full items-start gap-3 p-5 text-left hover:bg-slate-50", selected?.id === item.id && "bg-blue-50/60")}>
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded border", typeStyleMap[item.type])}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate font-bold text-slate-900">{item.title}</h4>
                      <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold", statusStyleMap[item.status])}>{item.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.scenario}</div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.summary}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="min-h-0 rounded-lg border border-slate-200 bg-white shadow-sm">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-100 p-6">
                <h3 className="text-xl font-bold text-slate-900">{selected.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{selected.summary}</p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => startEdit(selected)} className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Edit3 className="h-4 w-4" />编辑</button>
                  <button onClick={() => deleteItem(selected.id)} className="inline-flex items-center gap-1.5 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"><Trash2 className="h-4 w-4" />删除</button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.content}</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">请选择知识条目</div>
          )}
        </section>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={closeEditor}>
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-bold text-slate-900">{editingId ? "编辑知识" : "新增知识"}</h3>
              <button onClick={closeEditor} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="grid gap-4">
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm" placeholder="标题" />
                <input value={form.scenario} onChange={(e) => setForm((p) => ({ ...p, scenario: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm" placeholder="适用场景" />
                <input value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} className="h-10 rounded border border-slate-200 px-3 text-sm" placeholder="责任团队" />
                <textarea value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} rows={3} className="rounded border border-slate-200 px-3 py-2 text-sm" placeholder="摘要" />
                <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} rows={8} className="rounded border border-slate-200 px-3 py-2 text-sm" placeholder="正文" />
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} className="h-10 rounded border border-slate-200 px-3 text-sm" placeholder="标签，逗号分隔" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button onClick={closeEditor} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={saveForm} className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><Check className="h-4 w-4" />保存</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
