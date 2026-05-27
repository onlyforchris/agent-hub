export type AgentSkillMount = {
  id: string;
  agentId: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  description?: string;
  sideEffectLevel?: string;
  isDefault?: boolean;
  sortOrder?: number;
  policyOverride?: Record<string, unknown>;
};

export type AgentSkillMountItem = {
  skillId?: string;
  skillCode?: string;
  isDefault?: boolean;
  sortOrder?: number;
  policyOverride?: Record<string, unknown>;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

function authHeaders(accessToken: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function fetchAgentSkillMounts(
  accessToken: string | null,
  agentId: string,
): Promise<AgentSkillMount[]> {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
    headers: authHeaders(accessToken),
  });
  const payload = (await res.json()) as ApiEnvelope<AgentSkillMount[]>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "加载 Agent Skill 挂载失败");
  return payload.data ?? [];
}

export async function syncAgentSkillMounts(
  accessToken: string | null,
  agentId: string,
  mounts: AgentSkillMountItem[],
): Promise<AgentSkillMount[]> {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(accessToken) },
    body: JSON.stringify({ mounts }),
  });
  const payload = (await res.json()) as ApiEnvelope<AgentSkillMount[]>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "保存 Agent Skill 挂载失败");
  return payload.data ?? [];
}
