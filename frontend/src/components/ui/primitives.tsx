import React from "react";
import { cn } from "@/src/lib/utils.ts";

/** 对齐 frontend/docs/cssdemo.html 原子组件 */

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function UiButton({
  variant = "primary",
  className,
  children,
  icon,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97]",
        variant === "primary" && "ui-btn-primary",
        variant === "secondary" && "ui-btn-secondary",
        variant === "danger" && "ui-btn-danger",
        variant === "ghost" && "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800",
        className,
      )}
      {...props}
    >
      {icon ? <span className="flex h-4 w-4 items-center justify-center">{icon}</span> : null}
      {children}
    </button>
  );
}

export type BadgeType = "danger" | "warning" | "success" | "default";

export function UiBadge({ type = "default", className, children }: { type?: BadgeType; className?: string; children: React.ReactNode }) {
  const tones: Record<BadgeType, string> = {
    danger: "bg-red-50 text-red-600 ring-red-500/20",
    warning: "bg-yellow-50 text-yellow-600 ring-yellow-500/20",
    success: "bg-green-50 text-green-600 ring-green-500/20",
    default: "bg-slate-50 text-slate-600 ring-slate-500/20",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ring-1", tones[type], className)}>
      {children}
    </span>
  );
}

export type TabItem = { id: string; label: string; icon?: React.ReactNode };

export function UiTabs({
  tabs,
  activeTab,
  onChange,
  className,
}: {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex border-b border-slate-200 px-2", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2 border-b-2 px-6 py-3.5 text-sm font-medium transition-all duration-200",
            activeTab === t.id
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function UiSectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("mb-3 text-xs font-bold uppercase tracking-wider text-slate-400", className)}>{children}</h3>;
}

/** 大页面容器：审批详情等 */
export function UiPageSurface({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 统计卡片：cssdemo WorkspaceModule */
export function UiStatCard({
  label,
  value,
  icon,
  iconClassName,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconClassName: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconClassName)}>{icon}</div>
        <div className="min-w-0">
          <p className="mb-0.5 text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold leading-none text-slate-800">{value}</p>
        </div>
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  );
}

/** 图表/列表卡片 */
export function UiPanelCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-slate-100 bg-white p-6 shadow-sm", className)}>{children}</div>;
}

export function UiStepper({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="my-6 flex w-full items-center">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = index > currentStep;
        return (
          <React.Fragment key={step}>
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                  isCompleted && "bg-indigo-500 text-white shadow-md",
                  isCurrent && "border-2 border-indigo-500 bg-white text-indigo-600 ring-4 ring-indigo-50",
                  isPending && "border border-slate-200 bg-slate-100 text-slate-400",
                )}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "absolute top-10 whitespace-nowrap text-[11px] font-medium",
                  isCurrent ? "text-indigo-600" : "text-slate-500",
                )}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-[2px] flex-1 rounded-full transition-colors duration-300",
                  isCompleted ? "bg-indigo-500" : "bg-slate-200",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
