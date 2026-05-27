import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Loader2, Network, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { WorkflowCategory } from "@/src/types/workflow.ts";

interface Props {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; description: string; category: WorkflowCategory }) => void;
}

export function CreateWorkflowModal({ open, submitting = false, onClose, onSubmit }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("新建工作流");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<WorkflowCategory>("data_quality");

  useEffect(() => {
    if (!open) return;
    setName("新建工作流");
    setDescription("");
    setCategory("data_quality");
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 80);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    onSubmit({ name: trimmed, description: description.trim(), category });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !submitting && onClose()}
        >
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
                    <Network className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id={titleId} className="text-[17px] font-semibold text-slate-900">
                      新建 Workflow 模板
                    </h2>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                      创建后将进入 DAG 画布编辑器，可拖拽节点并配置质检流程。
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  aria-label="关闭"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-[12px] font-semibold text-slate-700">
                    模板名称 <span className="text-rose-500">*</span>
                  </span>
                  <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    placeholder="例如：收入回款对账治理"
                    className="ui-input mt-1.5 px-3 py-2.5 disabled:bg-slate-50"
                  />
                </label>

                <label className="block">
                  <span className="text-[12px] font-semibold text-slate-700">分类</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as WorkflowCategory)}
                    disabled={submitting}
                    className="ui-input mt-1.5 px-3 py-2.5 disabled:bg-slate-50"
                  >
                    <option value="data_quality">对账治理</option>
                    <option value="general">通用流程</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[12px] font-semibold text-slate-700">描述（可选）</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitting}
                    rows={3}
                    placeholder="简要说明该模板的业务场景与覆盖范围"
                    className="ui-input mt-1.5 resize-none px-3 py-2.5 disabled:bg-slate-50"
                  />
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onClose}
                  className="ui-btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="ui-btn-primary min-w-[100px] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      创建中…
                    </>
                  ) : (
                    "创建并编辑"
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


