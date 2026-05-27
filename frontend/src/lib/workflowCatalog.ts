import {
  buildDataQualityRevenueGraph,
  buildRevenueQualitySeedRecord,
  toWorkflowListItem,
} from "@/src/lib/workflowPresets.ts";
import type { WorkflowGraph, WorkflowListItem } from "@/src/types/workflow.ts";

/** 对账治理 Agent 一期默认绑定的 Workflow 模板 */
export const DATA_QUALITY_WORKFLOW_TEMPLATE_ID = "revenue_quality";

export function getDataQualityWorkflowListItem(): WorkflowListItem {
  return toWorkflowListItem(buildRevenueQualitySeedRecord());
}

export function getDataQualityWorkflowGraph(): WorkflowGraph {
  return buildDataQualityRevenueGraph();
}

/** Agent 配置向导：合并 API 列表与内置「收入回款对账治理」模板 */
export function mergeAgentWorkflowTemplates(remote: WorkflowListItem[]): WorkflowListItem[] {
  const preset = getDataQualityWorkflowListItem();
  const map = new Map<string, WorkflowListItem>();
  for (const item of remote) map.set(item.id, item);
  map.set(preset.id, preset);
  return Array.from(map.values()).sort((a, b) => {
    if (a.id === DATA_QUALITY_WORKFLOW_TEMPLATE_ID) return -1;
    if (b.id === DATA_QUALITY_WORKFLOW_TEMPLATE_ID) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** 已发布图：内置模板兜底（无后端 / 未发布时仍可预览） */
export function resolveWorkflowPublishedGraph(templateId: string): WorkflowGraph | null {
  if (templateId === DATA_QUALITY_WORKFLOW_TEMPLATE_ID) {
    return getDataQualityWorkflowGraph();
  }
  return null;
}

export function findWorkflowListItem(
  templates: WorkflowListItem[],
  templateId: string,
): WorkflowListItem {
  return (
    templates.find((t) => t.id === templateId) ??
    (templateId === DATA_QUALITY_WORKFLOW_TEMPLATE_ID
      ? getDataQualityWorkflowListItem()
      : { id: templateId, name: templateId, description: "", category: "general", status: "draft", publishedVersionId: null, latestVersionId: "", owner: "—", updatedAt: "", createdAt: "", latestVersion: "—", nodeCount: 0 })
  );
}

