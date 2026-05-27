export type ToolRegistryRow = {
  id: string;
  toolKey: string;
  toolName: string;
  category: string;
  description?: string;
  runtimeKind: string;
  scriptContent?: string;
  inputSchema?: string;
  outputSchema?: string;
  connector: string;
  dataSensitivity: string;
  sideEffect: string;
  permissionCode: string;
  version: string;
  owner?: string;
  isEnabled: number;
  sortOrder: number;
  status: number;
  remark?: string;
  createTime?: string;
  updateTime?: string;
};

export type ToolRegistryForm = {
  toolKey: string;
  toolName: string;
  category: string;
  description?: string;
  runtimeKind: string;
  scriptContent?: string;
  inputSchema?: string;
  outputSchema?: string;
  connector: string;
  dataSensitivity: string;
  sideEffect: string;
  permissionCode: string;
  version: string;
  owner?: string;
  isEnabled: number;
  sortOrder: number;
  remark?: string;
};

export type ToolTestResult = {
  success: boolean;
  data?: unknown;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
};

export type RuntimeToolCatalogItem = {
  toolKey: string;
  description: string;
  permission: string;
  inputSchema: Record<string, unknown>;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

function authHeaders(accessToken: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function fetchToolRegistry(accessToken: string | null): Promise<ToolRegistryRow[]> {
  const res = await fetch("/api/rbac/tools", { headers: authHeaders(accessToken) });
  const payload = (await res.json()) as ApiEnvelope<ToolRegistryRow[]>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "加载 Tool 注册表失败");
  return payload.data ?? [];
}

export async function fetchRuntimeToolCatalog(accessToken: string | null): Promise<RuntimeToolCatalogItem[]> {
  const res = await fetch("/api/tool/catalog", { headers: authHeaders(accessToken) });
  const payload = (await res.json()) as ApiEnvelope<RuntimeToolCatalogItem[]>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "加载运行时 Tool 目录失败");
  return payload.data ?? [];
}

export async function createToolRegistry(accessToken: string | null, body: ToolRegistryForm): Promise<string> {
  const res = await fetch("/api/rbac/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ApiEnvelope<string>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "新增 Tool 失败");
  return payload.data;
}

export async function updateToolRegistry(
  accessToken: string | null,
  id: string,
  body: Partial<ToolRegistryForm>,
): Promise<void> {
  const res = await fetch(`/api/rbac/tools/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ApiEnvelope<null>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "更新 Tool 失败");
}

export async function deleteToolRegistry(accessToken: string | null, id: string): Promise<void> {
  const res = await fetch(`/api/rbac/tools/${id}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  const payload = (await res.json()) as ApiEnvelope<null>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "删除 Tool 失败");
}

export async function testToolRegistry(
  accessToken: string | null,
  id: string,
  params: Record<string, unknown>,
): Promise<ToolTestResult> {
  const res = await fetch(`/api/rbac/tools/${id}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify({ params }),
  });
  const payload = (await res.json()) as ApiEnvelope<ToolTestResult>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "测试 Tool 失败");
  return payload.data;
}

export async function reloadToolRegistry(accessToken: string | null): Promise<void> {
  const res = await fetch("/api/rbac/tools/reload", {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  const payload = (await res.json()) as ApiEnvelope<{ reloaded: boolean }>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "重载 Tool 失败");
}

export function parseJsonSchema(text?: string): Record<string, unknown> {
  if (!text?.trim()) return { type: "object" };
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { type: "object" };
  }
}
