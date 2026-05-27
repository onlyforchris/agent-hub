export type ModelProviderRow = {
  id: string;
  providerCode: string;
  providerName: string;
  baseUrl: string;
  apiKey: string;
  models: string;
  defaultModel: string;
  isEnabled: number;
  sortOrder: number;
  status: number;
  remark?: string;
  createTime?: string;
  updateTime?: string;
};

export type ModelProviderForm = {
  providerCode: string;
  providerName: string;
  baseUrl: string;
  apiKey?: string;
  models: string;
  defaultModel: string;
  isEnabled: number;
  sortOrder: number;
  remark?: string;
};

export type ModelTestResult = {
  success: boolean;
  latencyMs: number;
  message: string;
  modelUsed: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export async function fetchModelProviders(accessToken: string | null): Promise<ModelProviderRow[]> {
  const res = await fetch("/api/rbac/model-providers", {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  const payload = (await res.json()) as ApiEnvelope<ModelProviderRow[]>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "加载模型供应商失败");
  return payload.data ?? [];
}

export async function createModelProvider(accessToken: string | null, body: ModelProviderForm): Promise<string> {
  const res = await fetch("/api/rbac/model-providers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ApiEnvelope<string>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "新增失败");
  return payload.data;
}

export async function updateModelProvider(
  accessToken: string | null,
  id: string,
  body: Partial<ModelProviderForm>,
): Promise<void> {
  const res = await fetch(`/api/rbac/model-providers/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ApiEnvelope<null>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "更新失败");
}

export async function deleteModelProvider(accessToken: string | null, id: string): Promise<void> {
  const res = await fetch(`/api/rbac/model-providers/${id}`, {
    method: "DELETE",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  const payload = (await res.json()) as ApiEnvelope<null>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "删除失败");
}

export async function testModelProvider(accessToken: string | null, id: string): Promise<ModelTestResult> {
  const res = await fetch(`/api/rbac/model-providers/${id}/test`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  const payload = (await res.json()) as ApiEnvelope<ModelTestResult>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "连接测试失败");
  return payload.data;
}

export function parseModelList(models: string): string[] {
  if (!models) return [];
  try {
    const parsed = JSON.parse(models) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return models.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export function stringifyModelList(models: string[]): string {
  return JSON.stringify(models);
}
