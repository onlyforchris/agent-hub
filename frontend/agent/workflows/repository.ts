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

export interface IWorkflowRepository {
  seedIfEmpty(): Promise<void>;
  list(filters?: { status?: string; category?: string; q?: string }): Promise<WorkflowListItem[]>;
  get(id: string): Promise<WorkflowTemplateRecord | null>;
  create(body: CreateWorkflowBody): Promise<WorkflowTemplateRecord>;
  update(id: string, body: UpdateWorkflowBody): Promise<WorkflowTemplateRecord>;
  delete(id: string): Promise<void>;
  listVersions(templateId: string): Promise<WorkflowVersion[]>;
  getVersion(templateId: string, versionId: string): Promise<WorkflowVersion | null>;
  createVersion(templateId: string, body: CreateVersionBody): Promise<WorkflowVersion>;
  saveGraph(templateId: string, versionId: string, graph: WorkflowGraph): Promise<WorkflowVersion>;
  validateGraph(graph: WorkflowGraph): DagValidationResult;
  publish(templateId: string, body: PublishWorkflowBody): Promise<WorkflowTemplateMeta>;
  unpublish(templateId: string): Promise<WorkflowTemplateMeta>;
  getPublishedGraph(templateId: string): Promise<WorkflowGraph | null>;
}

export class DbWorkflowRepository implements IWorkflowRepository {
  seedIfEmpty(): Promise<void> {
    throw new Error("DbWorkflowRepository: not implemented â€?use JsonWorkflowRepository");
  }
  list(): Promise<WorkflowListItem[]> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  get(): Promise<WorkflowTemplateRecord | null> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  create(): Promise<WorkflowTemplateRecord> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  update(): Promise<WorkflowTemplateRecord> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  delete(): Promise<void> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  listVersions(): Promise<WorkflowVersion[]> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  getVersion(): Promise<WorkflowVersion | null> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  createVersion(): Promise<WorkflowVersion> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  saveGraph(): Promise<WorkflowVersion> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  validateGraph(): DagValidationResult {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  publish(): Promise<WorkflowTemplateMeta> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  unpublish(): Promise<WorkflowTemplateMeta> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
  getPublishedGraph(): Promise<WorkflowGraph | null> {
    throw new Error("DbWorkflowRepository: not implemented");
  }
}

