package com.efloow.agenthub.common.tool;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Tool 注册中心业务分类（与前端展示一致）。
 */
public final class ToolCategories {

    public static final String DATA_QUERY = "data_query";
    public static final String RULE = "rule";
    public static final String COMPUTE = "compute";
    public static final String TEMPLATE = "template";
    public static final String NOTIFY = "notify";

    public static final Set<String> ALL = Set.of(DATA_QUERY, RULE, COMPUTE, TEMPLATE, NOTIFY);

    private static final Map<String, String> LABELS = new LinkedHashMap<>();

    static {
        LABELS.put(DATA_QUERY, "数据查询");
        LABELS.put(RULE, "规则判断");
        LABELS.put(COMPUTE, "计算处理");
        LABELS.put(TEMPLATE, "报告生成");
        LABELS.put(NOTIFY, "消息通知");
    }

    private ToolCategories() {
    }

    public static String labelOf(String category) {
        return LABELS.getOrDefault(category, category);
    }

    public static boolean isValid(String category) {
        return category != null && ALL.contains(category.trim());
    }
}
