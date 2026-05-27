import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "../lib/utils.ts";
import { NotificationBell } from "./NotificationBell.tsx";
import { APP_ROLES, type AppViewMode } from "./RoleSwitcher.tsx";
import { useAuth } from "../auth.tsx";

interface AppHeaderProps {
  breadcrumbs: string[];
  viewMode: AppViewMode;
  onSwitchRole: (mode: AppViewMode) => void;
}

/** 对齐 cssdemo.html GlobalHeader */
export function AppHeader({ breadcrumbs, viewMode, onSwitchRole }: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const currentRole = APP_ROLES.find((r) => r.id === viewMode) ?? APP_ROLES[0];
  const displayName = user?.displayName || user?.username || currentRole.name;

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
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-8 shadow-sm">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={`${crumb}-${index}`}>
            <span className={cn("truncate", index === breadcrumbs.length - 1 ? "text-slate-800" : "font-normal text-slate-400")}>
              {crumb}
            </span>
            {index < breadcrumbs.length - 1 && <span className="text-slate-300">/</span>}
          </React.Fragment>
        ))}
      </h2>

      <div className="flex shrink-0 items-center gap-5">
        <NotificationBell variant="header" />

        <div
          ref={shellRef}
          className="relative"
          onMouseLeave={() => setProfileOpen(false)}
        >
          <button
            type="button"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-3 rounded-full p-1.5 transition-colors hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden text-sm font-medium leading-none text-slate-700 sm:inline">{displayName}</span>
            <ChevronDown className="mr-1 h-4 w-4 text-slate-400" />
          </button>

          <div
            className={cn(
              "absolute right-0 mt-3 w-48 origin-top-right overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl transition-all duration-200",
              profileOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
            )}
          >
            <div className="border-b border-slate-50 bg-slate-50/50 px-4 py-3">
              <p className="text-sm font-bold text-slate-800">{displayName}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{currentRole.title}</p>
            </div>
            <div className="space-y-0.5 p-2">
              {APP_ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    onSwitchRole(role.id);
                    setProfileOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                    role.id === viewMode ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <span className="font-bold">{role.avatar}</span>
                  {role.name}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-50 p-2">
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
