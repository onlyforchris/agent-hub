import fs from "fs/promises";
import path from "path";
import { validateDag } from "@/src/lib/dagValidator.js";
import type {
  CreateVersionBody,
  CreateWorkflowBody,
  DagValidationResult,
  PublishWorkflowBody,
  UpdateWorkflowBody,
  WorkflowGraph,
  WorkflowListItem,
  WorkflowTemplateMeta,
  WorkflowTemplateRecord,
  WorkflowVersion,
} from "@/src/types/workflow.js";
import type { IWorkflowRepository } from "./repository.js";
import { buildDataQualityRevenueGraph, buildRevenueQualitySeedRecord } from "./seed-data-quality-revenue.js";

const DATA_DIR = path.join(process.cwd(), "data", "workflows");

function filePath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

function newId() {
  return `wf_${Date.now().toString(36)}`;
}

function newVersionId() {
  return `ver_${Date.now().toString(36)}`;
}

function toListItem(record: WorkflowTemplateRecord): WorkflowListItem {
  const latest = record.versions.find((v) => v.id === record.meta.latestVersionId);
  return {
    ...record.meta,
    latestVersion: latest?.version ?? "无",
    nodeCount: latest?.graph.nodes.length ?? 0,
  };
}

export class JsonWorkflowRepository implements IWorkflowRepository {
  async seedIfEmpty(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const files = await fs.readdir(DATA_DIR).catch(() => [] as string[]);
    if (files.some((f) => f.endsWith(".json"))) return;
    const seed = buildRevenueQualitySeedRecord();
    await fs.writeFile(filePath(seed.meta.id), JSON.stringify(seed, null, 2), "utf-8");
    console.log("[workflows] seeded revenue_quality template");
  }

  private async readAll(): Promise<WorkflowTemplateRecord[]> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const files = await fs.readdir(DATA_DIR);
    const records: WorkflowTemplateRecord[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(DATA_DIR, f), "utf-8");
      records.push(JSON.parse(raw) as WorkflowTemplateRecord);
    }
    return records;
  }

  private async read(id: string): Promise<WorkflowTemplateRecord | null> {
    try {
      const raw = await fs.readFile(filePath(id), "utf-8");
      return JSON.parse(raw) as WorkflowTemplateRecord;
    } catch {
      return null;
    }
  }

  private async write(record: WorkflowTemplateRecord): Promise<void> {
    record.meta.updatedAt = new Date().toISOString();
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filePath(record.meta.id), JSON.stringify(record, null, 2), "utf-8");
  }

  async list(filters?: { status?: string; category?: string; q?: string }): Promise<WorkflowListItem[]> {
    let items = (await this.readAll()).map(toListItem);
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
  }

  async get(id: string): Promise<WorkflowTemplateRecord | null> {
    return this.read(id);
  }

  async create(body: CreateWorkflowBody): Promise<WorkflowTemplateRecord> {
    if (body.cloneFrom) {
      const src = await this.read(body.cloneFrom);
      if (!src) throw new Error("clone source not found");
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
      await this.write(record);
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
    await this.write(record);
    return record;
  }

  async update(id: string, body: UpdateWorkflowBody): Promise<WorkflowTemplateRecord> {
    const record = await this.read(id);
    if (!record) throw new Error("template not found");
    if (body.name !== undefined) record.meta.name = body.name;
    if (body.description !== undefined) record.meta.description = body.description;
    if (body.owner !== undefined) record.meta.owner = body.owner;
    if (body.category !== undefined) record.meta.category = body.category;
    await this.write(record);
    return record;
  }

  async delete(id: string): Promise<void> {
    const record = await this.read(id);
    if (!record) throw new Error("template not found");
    if (record.meta.status === "published") {
      throw new Error("已发布模板请先下架再删除");
    }
    await fs.unlink(filePath(id));
  }

  async listVersions(templateId: string): Promise<WorkflowVersion[]> {
    const record = await this.read(templateId);
    if (!record) throw new Error("template not found");
    return [...record.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getVersion(templateId: string, versionId: string): Promise<WorkflowVersion | null> {
    const record = await this.read(templateId);
    if (!record) return null;
    return record.versions.find((v) => v.id === versionId) ?? null;
  }

  async createVersion(templateId: string, body: CreateVersionBody): Promise<WorkflowVersion> {
    const record = await this.read(templateId);
    if (!record) throw new Error("template not found");
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
    await this.write(record);
    return version;
  }

  async saveGraph(templateId: string, versionId: string, graph: WorkflowGraph): Promise<WorkflowVersion> {
    const record = await this.read(templateId);
    if (!record) throw new Error("template not found");
    const ver = record.versions.find((v) => v.id === versionId);
    if (!ver) throw new Error("version not found");
    if (ver.publishedAt) throw new Error("已发布版本不可直接修改，请创建新版本");
    const validation = validateDag(graph);
    if (!validation.valid) {
      const msg = validation.errors.map((e) => e.message).join("；");
      throw new Error(msg);
    }
    ver.graph = graph;
    await this.write(record);
    return ver;
  }

  validateGraph(graph: WorkflowGraph): DagValidationResult {
    return validateDag(graph);
  }

  async publish(templateId: string, body: PublishWorkflowBody): Promise<WorkflowTemplateMeta> {
    const record = await this.read(templateId);
    if (!record) throw new Error("template not found");
    const ver = record.versions.find((v) => v.id === body.versionId);
    if (!ver) throw new Error("version not found");
    const validation = validateDag(ver.graph);
    if (!validation.valid) {
      throw new Error(validation.errors.map((e) => e.message).join("；"));
    }
    const now = new Date().toISOString();
    ver.publishedAt = now;
    record.meta.status = "published";
    record.meta.publishedVersionId = ver.id;
    record.meta.latestVersionId = ver.id;
    await this.write(record);
    return record.meta;
  }

  async unpublish(templateId: string): Promise<WorkflowTemplateMeta> {
    const record = await this.read(templateId);
    if (!record) throw new Error("template not found");
    record.meta.status = "draft";
    record.meta.publishedVersionId = null;
    for (const v of record.versions) {
      if (v.id === record.meta.latestVersionId) v.publishedAt = null;
    }
    await this.write(record);
    return record.meta;
  }

  async getPublishedGraph(templateId: string): Promise<WorkflowGraph | null> {
    const record = await this.read(templateId);
    if (!record || !record.meta.publishedVersionId) return null;
    const ver = record.versions.find((v) => v.id === record.meta.publishedVersionId);
    return ver?.graph ?? null;
  }
}

export const workflowRepository: IWorkflowRepository = new JsonWorkflowRepository();

/** 供前端沙盒演示复用 */
export { buildDataQualityRevenueGraph };

