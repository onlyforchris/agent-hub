export type DiffStatus =
  | "PENDING_ATTRIBUTION"
  | "ATTRIBUTING"
  | "NEEDS_REVIEW"
  | "FORWARDED_TO_BUSINESS"
  | "BUSINESS_PROCESSING"
  | "BUSINESS_FEEDBACK"
  | "FINANCE_REVIEWING"
  | "CONFIRMED"
  | "PROCESSED"
  | "INSUFFICIENT_EVIDENCE_CLOSED";

export type ActorRole =
  | "SYSTEM"
  | "FINANCE_REVIEWER"
  | "GOV_MANAGER"
  | "SAP_PROCESSOR"
  | "DMS_PROCESSOR";

export type ActionCode =
  | "START_ATTRIBUTION"
  | "SYSTEM_ATTRIBUTION_DONE"
  | "CONFIRM_ATTRIBUTION"
  | "DISPATCH_TO_BUSINESS"
  | "CLAIM_TASK"
  | "SUBMIT_BUSINESS_FEEDBACK"
  | "START_FINANCE_REVIEW"
  | "REJECT_AND_REDISPATCH"
  | "CLOSE_INSUFFICIENT_EVIDENCE"
  | "ARCHIVE_CASE"
  | "REOPEN_CASE"
  | "REMIND";

export interface ActionConfig {
  action: ActionCode;
  label: string;
  from: DiffStatus[];
  to: DiffStatus | null;
  actorRoles: ActorRole[];
  requiredFields: string[];
  optionalFields: string[];
  guard?: string;
}

export const TERMINAL_STATUSES: DiffStatus[] = [
  "PROCESSED",
  "INSUFFICIENT_EVIDENCE_CLOSED",
];

export const ACTION_CONFIGS: ActionConfig[] = [
  {
    action: "START_ATTRIBUTION",
    label: "启动归因",
    from: ["PENDING_ATTRIBUTION"],
    to: "ATTRIBUTING",
    actorRoles: ["FINANCE_REVIEWER", "GOV_MANAGER"],
    requiredFields: [],
    optionalFields: ["runNote"],
  },
  {
    action: "SYSTEM_ATTRIBUTION_DONE",
    label: "归因完成",
    from: ["ATTRIBUTING"],
    to: "NEEDS_REVIEW",
    actorRoles: ["SYSTEM"],
    requiredFields: ["report", "confidence", "rootCause"],
    optionalFields: ["evidenceChain", "firstAbnormalNode"],
  },
  {
    action: "CONFIRM_ATTRIBUTION",
    label: "确认归因",
    from: ["NEEDS_REVIEW", "FINANCE_REVIEWING"],
    to: "CONFIRMED",
    actorRoles: ["FINANCE_REVIEWER"],
    requiredFields: ["reviewOpinion"],
    optionalFields: ["governanceTags"],
  },
  {
    action: "DISPATCH_TO_BUSINESS",
    label: "转派责任方",
    from: ["NEEDS_REVIEW", "FINANCE_REVIEWING"],
    to: "FORWARDED_TO_BUSINESS",
    actorRoles: ["FINANCE_REVIEWER", "GOV_MANAGER"],
    requiredFields: ["assigneeRole", "assigneeUserId", "dispatchComment", "dueAt"],
    optionalFields: [],
  },
  {
    action: "CLAIM_TASK",
    label: "认领处理",
    from: ["FORWARDED_TO_BUSINESS"],
    to: "BUSINESS_PROCESSING",
    actorRoles: ["SAP_PROCESSOR", "DMS_PROCESSOR"],
    requiredFields: [],
    optionalFields: ["claimComment"],
    guard: "actorRole must match assigneeRole",
  },
  {
    action: "SUBMIT_BUSINESS_FEEDBACK",
    label: "提交反馈",
    from: ["BUSINESS_PROCESSING"],
    to: "BUSINESS_FEEDBACK",
    actorRoles: ["SAP_PROCESSOR", "DMS_PROCESSOR"],
    requiredFields: ["actionType", "businessFeedback"],
    optionalFields: ["attachments"],
  },
  {
    action: "START_FINANCE_REVIEW",
    label: "进入复审",
    from: ["BUSINESS_FEEDBACK"],
    to: "FINANCE_REVIEWING",
    actorRoles: ["FINANCE_REVIEWER"],
    requiredFields: [],
    optionalFields: ["reviewStartNote"],
  },
  {
    action: "REJECT_AND_REDISPATCH",
    label: "驳回再处理",
    from: ["FINANCE_REVIEWING"],
    to: "FORWARDED_TO_BUSINESS",
    actorRoles: ["FINANCE_REVIEWER"],
    requiredFields: ["rejectReason", "assigneeRole", "assigneeUserId", "dueAt"],
    optionalFields: ["dispatchComment"],
  },
  {
    action: "CLOSE_INSUFFICIENT_EVIDENCE",
    label: "证据不足结案",
    from: ["NEEDS_REVIEW", "FINANCE_REVIEWING"],
    to: "INSUFFICIENT_EVIDENCE_CLOSED",
    actorRoles: ["FINANCE_REVIEWER", "GOV_MANAGER"],
    requiredFields: ["closeReason", "nextSourceOwner", "reopenCondition"],
    optionalFields: ["governanceTags", "attachments"],
  },
  {
    action: "ARCHIVE_CASE",
    label: "归档",
    from: ["CONFIRMED"],
    to: "PROCESSED",
    actorRoles: ["SYSTEM", "FINANCE_REVIEWER"],
    requiredFields: [],
    optionalFields: ["archiveNote"],
  },
  {
    action: "REOPEN_CASE",
    label: "重开",
    from: ["INSUFFICIENT_EVIDENCE_CLOSED", "PROCESSED"],
    to: "PENDING_ATTRIBUTION",
    actorRoles: ["FINANCE_REVIEWER", "GOV_MANAGER"],
    requiredFields: ["reopenReason", "reopenEvidence"],
    optionalFields: [],
  },
  {
    action: "REMIND",
    label: "催办",
    from: ["FORWARDED_TO_BUSINESS", "BUSINESS_PROCESSING", "BUSINESS_FEEDBACK"],
    to: null,
    actorRoles: ["FINANCE_REVIEWER", "GOV_MANAGER"],
    requiredFields: ["remindChannel"],
    optionalFields: ["remindComment"],
  },
];

export function getActionsByStatus(status: DiffStatus, role: ActorRole): ActionConfig[] {
  return ACTION_CONFIGS.filter((item) => item.from.includes(status) && item.actorRoles.includes(role));
}

export function canTransition(status: DiffStatus, action: ActionCode, role: ActorRole): boolean {
  const cfg = ACTION_CONFIGS.find((item) => item.action === action);
  if (!cfg) return false;
  return cfg.from.includes(status) && cfg.actorRoles.includes(role);
}
