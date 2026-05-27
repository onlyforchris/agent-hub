import { validateDag } from "@/src/lib/dagValidator.ts";
import { DATA_QUALITY_WORKFLOW_TEMPLATE_ID } from "@/src/lib/workflowCatalog.ts";
import { buildRevenueQualitySeedRecord, toWorkflowListItem } from "@/src/lib/workflowPresets.ts";
import type {
  CreateVersionBody,
  CreateWorkflowBody,
  PublishWorkflowBody,
  UpdateWorkflowBody,
  WorkflowGraph,
  WorkflowListItem,
  WorkflowTemplateMeta,
  WorkflowTemplateRecord,
  WorkflowVersion,
} from "@/src/types/workflow.ts";

const STORAGE_KEY = "tai-agent-hub:workflow-mock-v1";

function newId() {
  return `wf_${Date.now().toString(36)}`;
}

function newVersionId() {
  return `ver_${Date.now().toString(36)}`;
}

function ensureDataQualityTemplate(records: WorkflowTemplateRecord[]): WorkflowTemplateRecord[] {
  const seed = buildRevenueQualitySeedRecord();
  const idx = records.findIndex((r) => r.meta.id === DATA_QUALITY_WORKFLOW_TEMPLATE_ID);
  if (idx < 0) return [seed, ...records];
  const existing = records[idx];
  const publishedId = existing.meta.publishedVersionId ?? seed.meta.publishedVersionId;
  const merged: WorkflowTemplateRecord = {
    ...seed,
    meta: {
      ...seed.meta,
      ...existing.meta,
      id: DATA_QUALITY_WORKFLOW_TEMPLATE_ID,
      name: seed.meta.name,
      description: seed.meta.description,
      category: "data_quality",
      publishedVersionId: publishedId,
      latestVersionId: existing.meta.latestVersionId || seed.meta.latestVersionId,
      status: publishedId ? "published" : existing.meta.status,
    },
    versions: existing.versions.length > 0 ? existing.versions : seed.versions,
    draftVersionId: existing.draftVersionId || seed.draftVersionId,
  };
  const next = [...records];
  next[idx] = merged;
  return next;
}

function loadRecords(): WorkflowTemplateRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkflowTemplateRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const ensured = ensureDataQualityTemplate(parsed);
        if (JSON.stringify(ensured) !== JSON.stringify(parsed)) saveRecords(ensured);
        return ensured;
      }
    }
  } catch {
    /* ignore */
  }
  const seed = [buildRevenueQualitySeedRecord()];
  saveRecords(seed);
  return seed;
}

function saveRecords(records: WorkflowTemplateRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function read(id: string): WorkflowTemplateRecord | null {
  return loadRecords().find((r) => r.meta.id === id) ?? null;
}

function write(record: WorkflowTemplateRecord) {
  record.meta.updatedAt = new Date().toISOString();
  const records = loadRecords();
  const idx = records.findIndex((r) => r.meta.id === record.meta.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  saveRecords(records);
}

export function resetWorkflowMockStore() {
  localStorage.removeItem(STORAGE_KEY);
}

export const workflowMockStore = {
  list(filters?: { status?: string; category?: string; q?: string }): WorkflowListItem[] {
    let items = loadRecords().map(toWorkflowListItem);
    if (filters?.status) items = items.filter((i) => i.status === filters.status);
    if (filters?.category) items = items.filter((i) => i.category === filters.category);
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q),
      );
    }
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  get(id: string): WorkflowTemplateRecord {
    const record = read(id);
    if (!record) throw new Error("模板不存在");
    return record;
  },

  create(body: CreateWorkflowBody): WorkflowTemplateRecord {
    if (body.cloneFrom) {
      const src = read(body.cloneFrom);
      if (!src) throw new Error("复制源模板不存在");
      const vid = newVersionId();
      const now = new Date().toISOString();
      const id = newId();
      const draft = src.versions.find((v) => v.id === src.draftVersionId) ?? src.versions[0];
      const record: WorkflowTemplateRecord = {
        meta: {
          id,
          name: body.name || `${src.meta.name} (副本)`,
          description: body.description ?? src.meta.description,
          category: body.category ?? src.meta.category,
          status: "draft",
          publishedVersionId: null,
          latestVersionId: vid,
          owner: body.owner ?? src.meta.owner,
          updatedAt: now,
          createdAt: now,
        },
        versions: [
          {
            id: vid,
            templateId: id,
            version: "v0.1.0-draft",
            changelog: "从模板复制",
            graph: structuredClone(draft.graph),
            createdAt: now,
            createdBy: body.owner ?? "用户",
            publishedAt: null,
          },
        ],
        draftVersionId: vid,
      };
      write(record);
      return record;
    }

    const id = newId();
    const vid = newVersionId();
    const now = new Date().toISOString();
    const record: WorkflowTemplateRecord = {
      meta: {
        id,
        name: body.name,
        description: body.description ?? "",
        category: body.category ?? "general",
        status: "draft",
        publishedVersionId: null,
        latestVersionId: vid,
        owner: body.owner ?? "未指定",
        updatedAt: now,
        createdAt: now,
      },
      versions: [
        {
          id: vid,
          templateId: id,
          version: "v0.1.0-draft",
          changelog: "初始草稿",
          graph: { nodes: [], edges: [] },
          createdAt: now,
          createdBy: body.owner ?? "用户",
          publishedAt: null,
        },
      ],
      draftVersionId: vid,
    };
    write(record);
    return record;
  },

  update(id: string, body: UpdateWorkflowBody): WorkflowTemplateRecord {
    const record = read(id);
    if (!record) throw new Error("模板不存在");
    if (body.name !== undefined) record.meta.name = body.name;
    if (body.description !== undefined) record.meta.description = body.description;
    if (body.owner !== undefined) record.meta.owner = body.owner;
    if (body.category !== undefined) record.meta.category = body.category;
    write(record);
    return record;
  },

  delete(id: string): { ok: boolean } {
    const record = read(id);
    if (!record) throw new Error("模板不存在");
    if (record.meta.status === "published") {
      throw new Error("已发布模板请先下架再删除");
    }
    const records = loadRecords().filter((r) => r.meta.id !== id);
    saveRecords(records);
    return { ok: true };
  },

  versions(templateId: string): WorkflowVersion[] {
    const record = read(templateId);
    if (!record) throw new Error("模板不存在");
    return [...record.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createVersion(templateId: string, body: CreateVersionBody = {}): WorkflowVersion {
    const record = read(templateId);
    if (!record) throw new Error("模板不存在");
    const base =
      record.versions.find((v) => v.id === (body.fromVersionId ?? record.draftVersionId)) ??
      record.versions[0];
    const vid = newVersionId();
    const now = new Date().toISOString();
    const version: WorkflowVersion = {
      id: vid,
      templateId,
      version: `v${record.versions.length + 1}.0.0-draft`,
      changelog: body.changelog ?? "新版本",
      graph: structuredClone(base.graph),
      createdAt: now,
      createdBy: record.meta.owner,
      publishedAt: null,
    };
    record.versions.push(version);
    record.draftVersionId = vid;
    record.meta.latestVersionId = vid;
    record.meta.status = "draft";
    write(record);
    return version;
  },

  saveGraph(templateId: string, versionId: string, graph: WorkflowGraph): WorkflowVersion {
    const record = read(templateId);
    if (!record) throw new Error("模板不存在");
    const ver = record.versions.find((v) => v.id === versionId);
    if (!ver) throw new Error("版本不存在");
    if (ver.publishedAt) throw new Error("已发布版本不可直接修改，请创建新版本");
    const validation = validateDag(graph);
    if (!validation.valid) {
      throw new Error(validation.errors.map((e) => e.message).join("；"));
    }
    ver.graph = graph;
    write(record);
    return ver;
  },

  publish(templateId: string, body: PublishWorkflowBody): WorkflowTemplateMeta {
    const record = read(templateId);
    if (!record) throw new Error("模板不存在");
    const ver = record.versions.find((v) => v.id === body.versionId);
    if (!ver) throw new Error("版本不存在");
    const validation = validateDag(ver.graph);
    if (!validation.valid) {
      throw new Error(validation.errors.map((e) => e.message).join("；"));
    }
    const now = new Date().toISOString();
    ver.publishedAt = now;
    record.meta.status = "published";
    record.meta.publishedVersionId = ver.id;
    record.meta.latestVersionId = ver.id;
    write(record);
    return record.meta;
  },

  unpublish(templateId: string): WorkflowTemplateMeta {
    const record = read(templateId);
    if (!record) throw new Error("模板不存在");
    record.meta.status = "draft";
    record.meta.publishedVersionId = null;
    for (const v of record.versions) {
      if (v.id === record.meta.latestVersionId) v.publishedAt = null;
    }
    write(record);
    return record.meta;
  },

  publishedGraph(templateId: string): WorkflowGraph {
    const record = read(templateId);
    if (!record?.meta.publishedVersionId) {
      if (templateId === DATA_QUALITY_WORKFLOW_TEMPLATE_ID) {
        return buildRevenueQualitySeedRecord().versions[0]!.graph;
      }
      throw new Error("暂无已发布版本");
    }
    const ver = record.versions.find((v) => v.id === record.meta.publishedVersionId);
    if (!ver) {
      if (templateId === DATA_QUALITY_WORKFLOW_TEMPLATE_ID) {
        return buildRevenueQualitySeedRecord().versions[0]!.graph;
      }
      throw new Error("已发布版本不存在");
    }
    return ver.graph;
  },
};

