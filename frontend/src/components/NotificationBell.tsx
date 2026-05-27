import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, ChevronRight, CircleAlert, ListTodo } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/src/lib/utils.ts";

const mockNotifications = [
  { id: "1", title: "2026-04 月结批次新增 6 笔差异", desc: "待财务侧归因确认", time: "10 分钟前", unread: true, tone: "danger" },
  { id: "2", title: "TCH202604160002 归因完成，待复核", desc: "SAP 负责人已提交说明", time: "1 小时前", unread: true, tone: "info" },
  { id: "3", title: "DMS 负责人已确认 TCH202604160005", desc: "可进入结案复核", time: "2 小时前", unread: false, tone: "success" },
];

interface NotificationBellProps {
  badge?: number;
  variant?: "inline" | "standalone" | "header";
  onOpenChange?: (open: boolean) => void;
}

export function NotificationBell({ badge, variant = "standalone", onOpenChange }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [todoCount, setTodoCount] = useState(badge ?? 0);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isInline = variant === "inline";
  const isHeader = variant === "header";

  useEffect(() => {
    if (badge !== undefined) {
      setTodoCount(badge);
      return;
    }
    fetch("/api/differences")
      .then((res) => res.json())
      .then((data: Array<{ status: string }>) => {
        setTodoCount(data.filter((d) => d.status !== "COMPLETED").length);
      })
      .catch(() => {});
  }, [badge]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const unread = Math.min(todoCount, 9);

  const openTodo = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("workbench-tab-switch", { detail: { tab: "todo" } }));
  };

  const toggleOpen = () => setOpen((v) => !v);
  const bellRect = triggerRef.current?.getBoundingClientRect();

  const panel =
    open && bellRect
      ? createPortal(
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: isHeader ? -6 : 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            style={{
              position: "fixed",
              left: Math.max(12, Math.min(isHeader ? bellRect.right - 320 : bellRect.left - 222, window.innerWidth - 340)),
              top: isHeader ? bellRect.bottom + 10 : undefined,
              bottom: isHeader ? undefined : window.innerHeight - bellRect.top + 10,
              zIndex: 9999,
            }}
            className={cn(
              "w-80 overflow-hidden rounded-2xl border bg-white shadow-2xl",
              isHeader ? "border-slate-100" : "border-slate-200/80 shadow-[var(--shadow-soft-card)]",
            )}
          >
            <div className="flex items-center justify-between border-b border-slate-50 bg-slate-50/50 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-800">消息通知</h3>
              {isHeader ? (
                <span className="cursor-pointer text-xs text-indigo-600 hover:underline">全部已读</span>
              ) : unread > 0 ? (
                <span className="ui-badge-danger border-rose-100 bg-rose-50 px-2 py-0.5 text-[10px]">{unread} 条未读</span>
              ) : null}
            </div>
            <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {mockNotifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={openTodo}
                  className="flex w-full gap-3 px-4 py-3.5 text-left transition-all duration-[var(--dur-fast)] hover:bg-indigo-50/60 focus-visible:bg-indigo-50/60 focus-visible:outline-none"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control-md)]",
                      n.tone === "danger" && "bg-rose-50 text-rose-600",
                      n.tone === "info" && "bg-indigo-50 text-indigo-600",
                      n.tone === "success" && "bg-emerald-50 text-emerald-600",
                    )}
                  >
                    {n.tone === "danger" ? <CircleAlert className="h-4 w-4" /> : n.tone === "success" ? <CheckCheck className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-slate-800">{n.title}</p>
                      {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">{n.desc}</p>
                    <p className="mt-1.5 text-[10px] font-medium text-slate-400">{n.time}</p>
                  </div>
                  <ChevronRight className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openTodo}
              className="flex w-full items-center justify-center gap-2 border-t border-slate-100 bg-white px-4 py-3 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:outline-none"
            >
              查看全部待办
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>,
          document.body,
        )
      : null;

  return (
    <>
      {panel}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label="待办通知"
        aria-expanded={open}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
          }
        }}
        className={cn(
          "relative flex shrink-0 cursor-pointer items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
          isHeader
            ? cn(
                "h-10 w-10 rounded-full",
                open ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-100 hover:text-indigo-600",
              )
            : isInline
              ? cn("h-10 w-10 rounded-[var(--radius-control-md)]", open ? "bg-slate-800 text-indigo-300" : "text-slate-400 hover:bg-slate-800/70 hover:text-white")
              : cn(
                  "h-[52px] w-[52px] rounded-[var(--radius-control-md)] border",
                  open
                    ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600",
                ),
        )}
      >
        <Bell className={isInline || isHeader ? "h-5 w-5" : "h-5 w-5"} />
        {unread > 0 && (
          <span
            className={cn(
              "absolute flex items-center justify-center rounded-full bg-rose-500 font-bold text-white",
              isHeader
                ? "right-1.5 top-1.5 h-2 w-2 ring-2 ring-white"
                : isInline
                  ? "right-1 top-1 h-3.5 min-w-3.5 px-0.5 text-[8px] ring-2 ring-slate-900"
                  : "-right-1 -top-1 h-4 min-w-4 border-2 border-white px-1 text-[9px]",
            )}
          >
            {!isHeader && (unread > 9 ? "9+" : unread)}
          </span>
        )}
      </div>
    </>
  );
}
