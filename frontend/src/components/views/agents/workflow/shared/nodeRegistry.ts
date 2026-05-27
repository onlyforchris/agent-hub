import type { ElementType } from "react";
import {
  Activity,
  Database,
  GitBranch,
  GitMerge,
  Layers,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { NodeKind } from "@/src/types/workflow.ts";
import type { WorkflowTone } from "../WorkflowNode.tsx";

export type NodeRole = "start" | "end" | "process";

export type PaletteItem = {
  kind: NodeKind;
  label: string;
  group: string;
  role: NodeRole;
  defaultTitle: string;
  defaultDesc: string;
  defaultMeta: string;
  tone: WorkflowTone;
  icon: ElementType;
};

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    kind: "INPUT",
    label: "差异发现",
    group: "入口",
    role: "start",
    defaultTitle: "差异发现",
    defaultDesc: "帆软差异清单、月结批次、API 推送",
    defaultMeta: "diff_batch",
    tone: "blue",
    icon: Database,
  },
  {
    kind: "PROFILE",
    label: "对账治理",
    group: "质量",
    role: "process",
    defaultTitle: "对账治理",
    defaultDesc: "字段完整性、类型、空值、主键重复",
    defaultMeta: "quality_gate",
    tone: "cyan",
    icon: Activity,
  },
  {
    kind: "TRANSFORM",
    label: "标准化映射",
    group: "质量",
    role: "process",
    defaultTitle: "标准化映射",
    defaultDesc: "MDM、组织、客户、结算单口径统一",
    defaultMeta: "mapping",
    tone: "indigo",
    icon: Layers,
  },
  {
    kind: "JOIN",
    label: "证据汇聚",
    group: "证据",
    role: "process",
    defaultTitle: "证据汇聚",
    defaultDesc: "DMS / SAP / 接口日志证据合并",
    defaultMeta: "evidence_pack",
    tone: "emerald",
    icon: GitMerge,
  },
  {
    kind: "RULE",
    label: "规则归因",
    group: "规则",
    role: "process",
    defaultTitle: "规则归因",
    defaultDesc: "金额翻倍、状态异常、回传失败",
    defaultMeta: "rule_engine",
    tone: "emerald",
    icon: ShieldCheck,
  },
  {
    kind: "MODEL",
    label: "AI 报告",
    group: "智能",
    role: "process",
    defaultTitle: "AI 报告",
    defaultDesc: "脱敏证据摘要生成归因报告",
    defaultMeta: "model_gateway",
    tone: "amber",
    icon: Sparkles,
  },
  {
    kind: "REVIEW",
    label: "人工确认",
    group: "协同",
    role: "process",
    defaultTitle: "人工确认",
    defaultDesc: "财务、DMS、SAP 责任角色复核",
    defaultMeta: "review_route",
    tone: "rose",
    icon: GitBranch,
  },
  {
    kind: "ACTION",
    label: "处置回写",
    group: "协同",
    role: "process",
    defaultTitle: "处置回写",
    defaultDesc: "结论、责任系统、处理状态回写",
    defaultMeta: "writeback",
    tone: "blue",
    icon: Save,
  },
  {
    kind: "LEARN",
    label: "规则沉淀",
    group: "资产",
    role: "end",
    defaultTitle: "规则沉淀",
    defaultDesc: "沉淀案例、调优规则和知识库",
    defaultMeta: "case_library",
    tone: "slate",
    icon: RotateCcw,
  },
];

export function getPaletteItem(kind: NodeKind): PaletteItem {
  return PALETTE_ITEMS.find((p) => p.kind === kind) ?? PALETTE_ITEMS[0];
}

export function getNodeRole(kind: NodeKind): NodeRole {
  return getPaletteItem(kind).role;
}

export function newNodeId(kind: NodeKind) {
  return `${kind.toLowerCase()}_${Date.now().toString(36)}`;
}

