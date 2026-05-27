import type { ModelProviderRow } from "./modelProviders.ts";

export type ModelMonitorSummary = {
  llmCallCountToday: number;
  inputTokensToday: number;
  outputTokensToday: number;
  failedCallsToday: number;
  activeProviders: number;
  conversationSessions: number;
  tokensByProvider: Array<{ provider: string; total_tokens: number; call_count: number }>;
};

export type PageResult<T> = {
  total: number;
  page: number;
  pageSize: number;
  records: T[];
};

export type LlmCallRecord = {
  id: string;
  traceId?: string;
  sessionId?: string;
  userId?: string;
  agentId?: string;
  modelProvider?: string;
  modelName?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  status?: number;
  errorMessage?: string;
  createTime?: string;
};

export type ConversationSessionSummary = {
  session_id: string;
  user_id?: string;
  agent_id?: string;
  turn_count: number;
  last_time?: string;
  last_input?: string;
};

export type ConversationTurn = {
  id: string;
  sessionId: string;
  turnId: string;
  userId?: string;
  agentId?: string;
  userInput?: string;
  agentReply?: string;
  summary?: string;
  status?: number;
  createTime?: string;
};

export type ExecutionTraceRow = {
  id: string;
  traceId: string;
  userId?: string;
  sessionId?: string;
  agentId?: string;
  intentAction?: string;
  inputSummary?: string;
  llmModel?: string;
  llmTokens?: number;
  toolCalls?: number;
  durationMs?: number;
  status?: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
};

export type TokenTrendPoint = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

async function getJson<T>(url: string, accessToken: string | null): Promise<T> {
  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  const payload = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !payload.success) throw new Error(payload.message || "请求失败");
  return payload.data;
}

export function fetchMonitorSummary(accessToken: string | null) {
  return getJson<ModelMonitorSummary>("/api/rbac/model-monitor/summary", accessToken);
}

export function fetchTokenTrend(accessToken: string | null, days = 7) {
  return getJson<TokenTrendPoint[]>(`/api/rbac/model-monitor/token-trend?days=${days}`, accessToken);
}

export function fetchLlmCalls(
  accessToken: string | null,
  params: { page?: number; pageSize?: number; provider?: string; model?: string; status?: number },
) {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 20));
  if (params.provider) q.set("provider", params.provider);
  if (params.model) q.set("model", params.model);
  if (params.status !== undefined) q.set("status", String(params.status));
  return getJson<PageResult<LlmCallRecord>>(`/api/rbac/model-monitor/llm-calls?${q}`, accessToken);
}

export function fetchConversationSessions(
  accessToken: string | null,
  params: { page?: number; pageSize?: number; sessionId?: string; agentId?: string },
) {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 20));
  if (params.sessionId) q.set("sessionId", params.sessionId);
  if (params.agentId) q.set("agentId", params.agentId);
  return getJson<PageResult<ConversationSessionSummary>>(`/api/rbac/model-monitor/conversations?${q}`, accessToken);
}

export function fetchConversationTurns(accessToken: string | null, sessionId: string) {
  return getJson<ConversationTurn[]>(`/api/rbac/model-monitor/conversations/${sessionId}`, accessToken);
}

export function fetchExecutionTraces(
  accessToken: string | null,
  params: { page?: number; pageSize?: number; agentId?: string; status?: number },
) {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 20));
  if (params.agentId) q.set("agentId", params.agentId);
  if (params.status !== undefined) q.set("status", String(params.status));
  return getJson<PageResult<ExecutionTraceRow>>(`/api/rbac/model-monitor/traces?${q}`, accessToken);
}

export type { ModelProviderRow };
