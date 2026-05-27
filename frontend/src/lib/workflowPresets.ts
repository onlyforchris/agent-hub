import type { WorkflowGraph, WorkflowTemplateRecord } from "@/src/types/workflow.ts";
import {
  computeVerticalPipelineLayout,
  getLinearExecutionOrder,
  getPipelineEdgePatch,
} from "@/src/lib/workflowLayout.ts";

/** 收入回款对账治理 — 9 节点纵向主流程 */
export function buildDataQualityRevenueGraph(): WorkflowGraph {
  const nodeDefs = [
    { id: "intake", kind: "INPUT" as const, title: "差异发现", desc: "帆软差异清单、月结批次、API 推送", meta: "diff_batch" },
    { id: "profile", kind: "PROFILE" as const, title: "对账治理", desc: "字段完整性、类型、空值、主键重复", meta: "quality_gate" },
    { id: "standard", kind: "TRANSFORM" as const, title: "标准化映射", desc: "MDM、组织、客户、结算单口径统一", meta: "mapping" },
    { id: "evidence", kind: "JOIN" as const, title: "证据汇聚", desc: "DMS / SAP / 接口日志证据合并", meta: "evidence_pack" },
    { id: "rules", kind: "RULE" as const, title: "规则归因", desc: "金额翻倍、状态异常、回传失败", meta: "rule_engine" },
    { id: "report", kind: "MODEL" as const, title: "AI 报告", desc: "脱敏证据摘要生成归因报告", meta: "model_gateway" },
    { id: "review", kind: "REVIEW" as const, title: "人工确认", desc: "财务、DMS、SAP 责任角色复核", meta: "review_route" },
    { id: "writeback", kind: "ACTION" as const, title: "处置回写", desc: "结论、责任系统、处理状态回写", meta: "writeback" },
    { id: "learn", kind: "LEARN" as const, title: "规则沉淀", desc: "沉淀案例、调优规则和知识库", meta: "case_library" },
  ];

  const edges = [
    { id: "e-intake-profile", source: "intake", target: "profile" },
    { id: "e-profile-standard", source: "profile", target: "standard" },
    { id: "e-standard-evidence", source: "standard", target: "evidence" },
    { id: "e-evidence-rules", source: "evidence", target: "rules" },
    { id: "e-rules-report", source: "rules", target: "report" },
    { id: "e-report-review", source: "report", target: "review" },
    { id: "e-review-writeback", source: "review", target: "writeback" },
    { id: "e-writeback-learn", source: "writeback", target: "learn" },
  ];

  const order = getLinearExecutionOrder(
    nodeDefs.map((d) => d.id),
    edges,
  );
  const slots = computeVerticalPipelineLayout(order);

  const nodes = nodeDefs.map((def) => {
    const slot = slots.get(def.id);
    return {
      id: def.id,
      kind: def.kind,
      position: { x: slot?.x ?? 48, y: slot?.y ?? 48 },
      data: { title: def.title, desc: def.desc, meta: def.meta },
    };
  });

  const edgesWithHandles = edges.map((e) => {
    const patch = getPipelineEdgePatch(order, e.source, e.target);
    return {
      ...e,
      sourceHandle: patch.sourceHandle,
      targetHandle: patch.targetHandle,
    };
  });

  return { nodes, edges: edgesWithHandles, viewport: { x: 0, y: 0, zoom: 0.85 } };
}

export function buildRevenueQualitySeedRecord(): WorkflowTemplateRecord {
  const now = new Date().toISOString();
  const versionId = "ver-1-0-0";
  const graph = buildDataQualityRevenueGraph();

  return {
    meta: {
      id: "revenue_quality",
      name: "收入回款对账治理",
      description: "覆盖差异接入、规则归因、AI 报告、人工复核、处置回写和案例沉淀。",
      category: "data_quality",
      status: "published",
      publishedVersionId: versionId,
      latestVersionId: versionId,
      owner: "财务共享中心",
      updatedAt: now,
      createdAt: now,
    },
    versions: [
      {
        id: versionId,
        templateId: "revenue_quality",
        version: "v1.0.0",
        changelog: "首期对账治理 DAG 模板",
        graph,
        createdAt: now,
        createdBy: "系统预设",
        publishedAt: now,
      },
    ],
    draftVersionId: versionId,
  };
}

export function toWorkflowListItem(record: WorkflowTemplateRecord) {
  const latest = record.versions.find((v) => v.id === record.meta.latestVersionId);
  return {
    ...record.meta,
    latestVersion: latest?.version ?? "—",
    nodeCount: latest?.graph.nodes.length ?? 0,
  };
}

