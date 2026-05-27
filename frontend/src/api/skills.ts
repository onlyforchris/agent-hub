export type SkillSummary = {
  id: string;
  skillCode: string;
  skillName: string;
  description: string;
  category?: string;
  tags?: string[];
  sideEffectLevel?: string;
  autoInvoke?: boolean;
  isEnabled?: boolean;
  version?: string;
  publishStatus?: string;
};

export type SkillResource = {
  id: string;
  skillId: string;
  resourcePath: string;
  resourceKind?: string;
  contentText?: string;
  storageUri?: string;
  remark?: string;
};

export type SkillRouteCandidate = {
  skillCode: string;
  score: number;
  reason?: string;
  matchedBy?: string;
};

export type SkillRouteTestResult = {
  selectedSkillCode?: string;
  candidates?: SkillRouteCandidate[];
};

export type SkillRouteTestRequest = {
  inputText: string;
  agentId?: string;
  workspacePaths?: string[];
  topK?: number;
};

export type SkillDetail = SkillSummary & {
  contentMd?: string;
  frontmatterJson?: Record<string, unknown>;
  policyJson?: Record<string, unknown>;
  pathsJson?: string[];
  contextMode?: string;
  requireConfirm?: boolean;
  owner?: string;
  remark?: string;
  resources?: SkillResource[];
};

export type SkillUpsertForm = {
  skillCode: string;
  skillName: string;
  description: string;
  category?: string;
  tags?: string[];
  contentMd?: string;
  policyJson?: Record<string, unknown>;
  pathsJson?: string[];
  autoInvoke?: boolean;
  requireConfirm?: boolean;
  contextMode?: string;
  owner?: string;
  remark?: string;
  sortOrder?: number;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

function authHeaders(accessToken: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function fetchSkillRegistry(accessToken: string | null): Promise<SkillSummary[]> {
  const res = await fetch("/api/skills", { headers: authHeaders(accessToken) });
  const payload = (await res.json()) as ApiEnvelope<SkillSummary[]>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "加载 Skill 列表失败");
  return payload.data ?? [];
}

export async function fetchSkillCatalog(accessToken: string | null): Promise<SkillSummary[]> {
  const res = await fetch("/api/skills/catalog", { headers: authHeaders(accessToken) });
  const payload = (await res.json()) as ApiEnvelope<SkillSummary[]>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "加载 Skill 目录失败");
  return payload.data ?? [];
}

export async function fetchSkillDetail(accessToken: string | null, id: string): Promise<SkillDetail> {
  const res = await fetch(`/api/skills/${id}`, { headers: authHeaders(accessToken) });
  const payload = (await res.json()) as ApiEnvelope<SkillDetail>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "加载 Skill 详情失败");
  return payload.data;
}

export async function createSkill(accessToken: string | null, body: SkillUpsertForm): Promise<string> {
  const res = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ApiEnvelope<string>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "新增 Skill 失败");
  return payload.data;
}

export async function updateSkill(
  accessToken: string | null,
  id: string,
  body: Partial<SkillUpsertForm>,
): Promise<void> {
  const res = await fetch(`/api/skills/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ApiEnvelope<null>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "更新 Skill 失败");
}

export async function deleteSkill(accessToken: string | null, id: string): Promise<void> {
  const res = await fetch(`/api/skills/${id}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  const payload = (await res.json()) as ApiEnvelope<null>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "删除 Skill 失败");
}

export async function publishSkill(accessToken: string | null, id: string): Promise<SkillDetail> {
  const res = await fetch(`/api/skills/${id}/publish`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  const payload = (await res.json()) as ApiEnvelope<SkillDetail>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "发布 Skill 失败");
  return payload.data;
}

export async function reloadSkillRegistry(accessToken: string | null): Promise<void> {
  const res = await fetch("/api/skills/reload", {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  const payload = (await res.json()) as ApiEnvelope<{ reloaded: boolean }>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "重载 Skill 失败");
}

export async function importSkillMarkdown(
  accessToken: string | null,
  file: File,
): Promise<SkillDetail> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/skills/import", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: form,
  });
  const payload = (await res.json()) as ApiEnvelope<SkillDetail>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "导入 Skill 失败");
  return payload.data;
}

export async function exportSkillMarkdown(accessToken: string | null, id: string): Promise<Blob> {
  const res = await fetch(`/api/skills/${id}/export?format=markdown`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as ApiEnvelope<null> | null;
    throw new Error(payload?.message || "导出 Skill 失败");
  }
  return res.blob();
}

export async function fetchSkillResources(
  accessToken: string | null,
  skillId: string,
): Promise<SkillResource[]> {
  const res = await fetch(`/api/skills/${skillId}/resources`, { headers: authHeaders(accessToken) });
  const payload = (await res.json()) as ApiEnvelope<SkillResource[]>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "加载 Skill 资源失败");
  return payload.data ?? [];
}

export async function testSkillRoute(
  accessToken: string | null,
  body: SkillRouteTestRequest,
): Promise<SkillRouteTestResult> {
  const res = await fetch("/api/skills/test-route", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ApiEnvelope<SkillRouteTestResult>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "路由仿真失败");
  return payload.data;
}

export async function exportSkillZip(accessToken: string | null, id: string): Promise<Blob> {
  const res = await fetch(`/api/skills/${id}/export?format=zip`, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as ApiEnvelope<null> | null;
    throw new Error(payload?.message || "导出 Skill 包失败");
  }
  return res.blob();
}

export const DEFAULT_SKILL_POLICY = {
  network: { mode: "allow_with_confirm", allowlist: [] },
  filesystem_write: { mode: "allow_with_confirm", paths: ["**"] },
  scripts: { mode: "allow_with_confirm", sandbox: "strict" },
  tools: { mode: "inherit", allowlist: [], denylist: [] },
  side_effect_level: "medium",
  auto_invoke: true,
  context: "inline",
};
