import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type PermissionCode = string;
type RoleCode = string;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  mobile?: string;
  orgId?: string;
  orgName?: string;
  enabled?: boolean;
  roles: RoleCode[];
  permissions: PermissionCode[];
}

interface AuthContextValue {
  loading: boolean;
  user: SessionUser | null;
  accessToken: string | null;
  login: (username: string, password: string, captchaId: string, captchaCode: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: PermissionCode) => boolean;
}

const ACCESS_KEY = "agent_hub_access_token";
const REFRESH_KEY = "agent_hub_refresh_token";

const AuthContext = createContext<AuthContextValue | null>(null);

interface ApiEnvelope<T> {
  success: boolean;
  traceId?: string;
  code: string;
  message: string;
  data: T;
}

interface AuthLoginData {
  token: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  username: string;
  nickname: string;
  dataScope: string;
  permissions: string[];
  menuIds: string[];
  agentIds: string[];
}

interface AuthMeData {
  userId: string;
  username: string;
  nickname: string;
  departmentId?: string;
  email?: string;
  phone?: string;
  dataScope: string;
  permissions: string[];
  menuIds: string[];
  agentIds: string[];
}

function mapUser(me: AuthMeData): SessionUser {
  return {
    id: me.userId,
    username: me.username,
    displayName: me.nickname || me.username,
    email: me.email,
    mobile: me.phone,
    orgId: me.departmentId,
    roles: [],
    permissions: me.permissions ?? [],
  };
}

async function requestJson<T>(url: string, init?: RequestInit, accessToken?: string | null): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const resp = await fetch(url, { ...init, headers });
  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await resp.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }
  if (!resp.ok) {
    throw new Error(payload?.message || `HTTP ${resp.status}`);
  }
  if (!payload) {
    throw new Error("响应解析失败");
  }
  if (!payload.success) {
    throw new Error(payload.message || payload.code || "请求失败");
  }
  return payload.data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem(ACCESS_KEY));

  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) throw new Error("No refresh token");
    const data = await requestJson<AuthLoginData>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    localStorage.setItem(ACCESS_KEY, data.token);
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_KEY, data.refreshToken);
    }
    setAccessToken(data.token);
    return data.token;
  };

  const loadMe = async (token: string) => {
    try {
      const me = await requestJson<AuthMeData>("/api/auth/me", { method: "GET" }, token);
      setUser(mapUser(me));
      return;
    } catch {
      const newToken = await refreshAccessToken();
      const me = await requestJson<AuthMeData>("/api/auth/me", { method: "GET" }, newToken);
      setUser(mapUser(me));
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (accessToken) await loadMe(accessToken);
      } catch {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const login = async (username: string, password: string, captchaId: string, captchaCode: string) => {
    const data = await requestJson<AuthLoginData>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, captchaId, captchaCode }),
    });
    localStorage.setItem(ACCESS_KEY, data.token);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    setAccessToken(data.token);
    setUser({
      id: data.userId,
      username: data.username,
      displayName: data.nickname || data.username,
      roles: [],
      permissions: data.permissions ?? [],
    });
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    try {
      if (refreshToken) {
        await requestJson("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
      }
    } catch {
      // ignore logout failure and clear local session
    } finally {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      setAccessToken(null);
      setUser(null);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      accessToken,
      login,
      logout,
      can: (permission) => Boolean(user?.permissions.includes(permission)),
    }),
    [loading, user, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function Permission({
  code,
  fallback = null,
  children,
}: {
  code: PermissionCode;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(code) ? children : fallback}</>;
}
