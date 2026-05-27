/** 与后端 ToolCategories 及 sys_tool_registry.category 一致 */
export const TOOL_CATEGORIES = [
  "data_query",
  "rule",
  "compute",
  "template",
  "notify",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  data_query: "数据查询",
  rule: "规则判断",
  compute: "计算处理",
  template: "报告生成",
  notify: "消息通知",
};

export const TOOL_CATEGORY_DESCRIPTIONS: Record<ToolCategory, string> = {
  data_query: "外部系统/库表只读查询与结果后处理",
  rule: "一致性、阈值、状态组合等业务规则判断",
  compute: "汇总、换算、预测等确定性计算",
  template: "报告、摘要、Markdown 等文本生成",
  notify: "站内信、待办、机器人等通知触达",
};

export function isToolCategory(value: string): value is ToolCategory {
  return (TOOL_CATEGORIES as readonly string[]).includes(value);
}
