import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, LogOut, Settings2, ShieldCheck, User, UserCircle } from "lucide-react";
import { cn } from "../lib/utils.ts";
import { NotificationBell } from "./NotificationBell.tsx";
import { useAuth } from "../auth.tsx";

export type AppViewMode = "finance" | "sap" | "dms" | "admin";

export interface AppRole {
  id: AppViewMode;
  name: string;
  title: string;
  avatar: string;
  icon: React.ElementType;
}

export const APP_ROLES: AppRole[] = [
  { id: "finance", name: "财务专员", title: "财务对账处理", avatar: "财", icon: User },
  { id: "sap", name: "SAP 负责人", title: "SAP 处理组", avatar: "SAP", icon: User },
  { id: "dms", name: "DMS 负责人", title: "DMS 处理组", avatar: "DMS", icon: User },
  { id: "admin", name: "管理员", title: "平台运营 / IT", avatar: "FT", icon: Settings2 },
];

interface RoleSwitcherProps {
  viewMode: AppViewMode;
  onSwitch: (mode: AppViewMode) => void;
}

export function RoleSwitcher({ viewMode, onSwitch }: RoleSwitcherProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const current = APP_ROLES.find((r) => r.id === viewMode) ?? APP_ROLES[0];
  const { user, logout } = useAuth();
  const displayName = user?.displayName || user?.username || current.name;
  const displayOrg = user?.orgName || current.title;

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!shellRef.current?.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={shellRef} className="relative">
      {profileOpen && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-3 overflow-hidden rounded-[var(--radius-panel)] border border-slate-700/70 bg-slate-900 shadow-[var(--shadow-soft-sidebar)]">
          <div className="border-b border-slate-700/70 bg-slate-800/70 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-[0_12px_28px_-12px_rgba(139,92,246,0.8)]">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{displayName}</p>
                <p className="truncate text-[11px] text-slate-400">{user?.email || user?.mobile || displayOrg}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 px-3 py-3">
            <div className="rounded-[var(--radius-card)] border border-slate-700/70 bg-slate-800/60 px-3 py-2.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-300" />
                当前权限
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-slate-100">
                {current.name} · {displayOrg}
              </p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-slate-700/70 bg-slate-800/40 p-1.5">
              <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">切换账号</p>
              {APP_ROLES.map((role) => {
                const active = role.id === viewMode;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      onSwitch(role.id);
                      setProfileOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[var(--radius-control-md)] px-2.5 py-2 text-left transition-all duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40",
                      active ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[var(--shadow-soft-brand)]" : "text-slate-300 hover:bg-slate-700/70 hover:text-white",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control-sm)] text-[10px] font-bold",
                        active ? "bg-white/20 text-white" : "bg-slate-700 text-slate-300",
                      )}
                    >
                      {role.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{role.name}</p>
                      <p className={cn("truncate text-[10px]", active ? "text-indigo-100" : "text-slate-500")}>{role.title}</p>
                    </div>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-[var(--radius-control-md)] px-3 text-left text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:bg-slate-800 focus-visible:outline-none"
            >
              <UserCircle className="h-4 w-4 text-slate-500" />
              个人中心
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-10 items-center gap-2 rounded-[var(--radius-control-md)] px-3 text-left text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200 focus-visible:bg-rose-500/10 focus-visible:outline-none"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[var(--radius-panel)] border border-slate-700/70 bg-slate-800/45 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-slate-700/60 bg-slate-900/55 px-2 py-2">
          <button
            type="button"
            aria-label="打开个人中心"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((v) => !v)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control-md)] px-1.5 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40",
              profileOpen ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control-md)] bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(139,92,246,0.85)]">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold leading-tight">{displayName}</p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{current.name} · {displayOrg}</p>
            </div>
            <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", profileOpen && "-rotate-90 text-indigo-300")} />
          </button>
          <NotificationBell variant="inline" />
        </div>
      </div>
    </div>
  );
}
