export type NodeKind =
  | "INPUT"
  | "PROFILE"
  | "TRANSFORM"
  | "JOIN"
  | "RULE"
  | "MODEL"
  | "REVIEW"
  | "ACTION"
  | "LEARN";

export type WorkflowStatus = "draft" | "published" | "archived";
export type WorkflowCategory = "data_quality" | "general";

export interface WorkflowGraphNodeData {
  title: string;
  desc: string;
  meta: string;
  config?: Record<string, unknown>;
}

export interface WorkflowGraphNode {
  id: string;
  kind: NodeKind;
  position: { x: number; y: number };
  data: WorkflowGraphNodeData;
}

export interface WorkflowGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface WorkflowVersion {
  id: string;
  templateId: string;
  version: string;
  changelog: string;
  graph: WorkflowGraph;
  createdAt: string;
  createdBy: string;
  publishedAt: string | null;
}

export interface WorkflowTemplateMeta {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  status: WorkflowStatus;
  publishedVersionId: string | null;
  latestVersionId: string;
  owner: string;
  updatedAt: string;
  createdAt: string;
}

export interface WorkflowTemplateRecord {
  meta: WorkflowTemplateMeta;
  versions: WorkflowVersion[];
  draftVersionId: string;
}

export interface WorkflowListItem extends WorkflowTemplateMeta {
  latestVersion: string;
  nodeCount: number;
}

export interface DagValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface DagValidationResult {
  valid: boolean;
  errors: DagValidationIssue[];
  warnings: DagValidationIssue[];
}

export interface CreateWorkflowBody {
  name: string;
  description?: string;
  category?: WorkflowCategory;
  owner?: string;
  cloneFrom?: string;
}

export interface UpdateWorkflowBody {
  name?: string;
  description?: string;
  owner?: string;
  category?: WorkflowCategory;
}

export interface PublishWorkflowBody {
  versionId: string;
}

export interface CreateVersionBody {
  changelog?: string;
  fromVersionId?: string;
}
