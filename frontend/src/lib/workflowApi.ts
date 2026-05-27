import type {
  CreateVersionBody,
  CreateWorkflowBody,
  DagValidationResult,
  PublishWorkflowBody,
  UpdateWorkflowBody,
  WorkflowGraph,
  WorkflowListItem,
  WorkflowTemplateRecord,
  WorkflowVersion,
} from "@/src/types/workflow.ts";
import { resolveWorkflowPublishedGraph } from "@/src/lib/workflowCatalog.ts";
import { workflowMockStore } from "@/src/lib/workflowMockStore.ts";

const BASE = "/api/workflows";

export type WorkflowDataSource = "api" | "mock";

/** null = 尚未探测；开发环境默认 mock，避免无后端时反复 404 */
let dataSource: WorkflowDataSource | null = import.meta.env.DEV ? "mock" : null;

export function getWorkflowDataSource(): WorkflowDataSource {
  return dataSource ?? (import.meta.env.DEV ? "mock" : "api");
}

/** 用户点击「重连 API」时调用，下次请求会尝试走后端 */
export function resetWorkflowDataSource() {
  dataSource = null;
}

async function probeApi(): Promise<WorkflowDataSource> {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return res.ok ? "api" : "mock";
  } catch {
    return "mock";
  }
}

async function resolveDataSource(): Promise<WorkflowDataSource> {
  if (dataSource !== null) return dataSource;
  dataSource = await probeApi();
  return dataSource;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function withFallback<T>(apiCall: () => Promise<T>, mockCall: () => T | Promise<T>): Promise<T> {
  const source = await resolveDataSource();
  if (source === "mock") {
    return Promise.resolve(mockCall());
  }
  try {
    const result = await apiCall();
    dataSource = "api";
    return result;
  } catch {
    dataSource = "mock";
    return Promise.resolve(mockCall());
  }
}

export const workflowApi = {
  list(params?: { status?: string; category?: string; q?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.category) qs.set("category", params.category);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return withFallback(
      () => fetch(`${BASE}${suffix}`).then(json<WorkflowListItem[]>),
      () => workflowMockStore.list(params),
    );
  },

  get(id: string) {
    return withFallback(
      () => fetch(`${BASE}/${id}`).then(json<WorkflowTemplateRecord>),
      () => workflowMockStore.get(id),
    );
  },

  create(body: CreateWorkflowBody) {
    return withFallback(
      () =>
        fetch(BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(json<WorkflowTemplateRecord>),
      () => workflowMockStore.create(body),
    );
  },

  update(id: string, body: UpdateWorkflowBody) {
    return withFallback(
      () =>
        fetch(`${BASE}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(json<WorkflowTemplateRecord>),
      () => workflowMockStore.update(id, body),
    );
  },

  delete(id: string) {
    return withFallback(
      () => fetch(`${BASE}/${id}`, { method: "DELETE" }).then(json<{ ok: boolean }>),
      () => workflowMockStore.delete(id),
    );
  },

  versions(id: string) {
    return withFallback(
      () => fetch(`${BASE}/${id}/versions`).then(json<WorkflowVersion[]>),
      () => workflowMockStore.versions(id),
    );
  },

  createVersion(id: string, body: CreateVersionBody = {}) {
    return withFallback(
      () =>
        fetch(`${BASE}/${id}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(json<WorkflowVersion>),
      () => workflowMockStore.createVersion(id, body),
    );
  },

  getVersion(templateId: string, versionId: string) {
    return withFallback(
      () => fetch(`${BASE}/${templateId}/versions/${versionId}`).then(json<WorkflowVersion>),
      async () => {
        const record = workflowMockStore.get(templateId);
        const ver = record.versions.find((v) => v.id === versionId);
        if (!ver) throw new Error("版本不存在");
        return ver;
      },
    );
  },

  saveGraph(templateId: string, versionId: string, graph: WorkflowGraph) {
    return withFallback(
      () =>
        fetch(`${BASE}/${templateId}/versions/${versionId}/graph`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(graph),
        }).then(json<WorkflowVersion>),
      () => workflowMockStore.saveGraph(templateId, versionId, graph),
    );
  },

  validate(templateId: string, graph: WorkflowGraph) {
    return withFallback(
      () =>
        fetch(`${BASE}/${templateId}/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ graph }),
        }).then(json<DagValidationResult>),
      async () => {
        const { validateDag } = await import("@/src/lib/dagValidator.ts");
        return validateDag(graph);
      },
    );
  },

  publish(templateId: string, body: PublishWorkflowBody) {
    return withFallback(
      () =>
        fetch(`${BASE}/${templateId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(json),
      () => workflowMockStore.publish(templateId, body),
    );
  },

  unpublish(templateId: string) {
    return withFallback(
      () => fetch(`${BASE}/${templateId}/unpublish`, { method: "POST" }).then(json),
      () => workflowMockStore.unpublish(templateId),
    );
  },

  publishedGraph(templateId: string) {
    return withFallback(
      () => fetch(`${BASE}/${templateId}/graph`).then(json<WorkflowGraph>),
      () => {
        try {
          return workflowMockStore.publishedGraph(templateId);
        } catch {
          const fallback = resolveWorkflowPublishedGraph(templateId);
          if (fallback) return fallback;
          throw new Error("暂无已发布版本");
        }
      },
    );
  },
};

