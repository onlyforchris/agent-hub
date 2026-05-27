package com.efloow.agenthub.infrastructure.tool.todo;

import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.system.entity.AgentTodo;
import com.efloow.agenthub.system.service.TodoService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class TodoCreateTool implements ToolHandler {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern RELATIVE_MINUTES = Pattern.compile("(\\d+)\\s*分钟\\s*[后内]|in\\s+(\\d+)\\s*min");
    private static final Pattern RELATIVE_HOURS = Pattern.compile("(\\d+)\\s*小时\\s*[后内]|in\\s+(\\d+)\\s*hour");
    private static final Pattern RELATIVE_DAYS = Pattern.compile("(\\d+)\\s*天\\s*[后内]|in\\s+(\\d+)\\s*day");

    private final TodoService todoService;

    public TodoCreateTool(TodoService todoService) {
        this.todoService = todoService;
    }

    @Override
    public String toolKey() {
        return "todo.create";
    }

    @Override
    public String description() {
        return "创建个人待办。dueDate/remindAt 支持两种格式: (1) 绝对时间 \"yyyy-MM-dd HH:mm:ss\", "
               + "(2) 相对时间 \"5分钟后\" \"1小时后\" \"明天\" \"in 5 min\"。"
               + "当前时间可通过 system.time.now 获取。";
    }

    @Override
    public String permission() {
        return "LEVEL_1";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "title", Map.of("type", "string", "description", "待办标题"),
                "description", Map.of("type", "string", "description", "待办详细描述"),
                "dueDate", Map.of("type", "string", "description",
                    "截止日期。绝对时间格式 yyyy-MM-dd HH:mm:ss (如 2026-05-03 18:00:00)，"
                    + "也支持相对时间如 \"5分钟后\" \"1小时后\" \"明天\" \"后天\""),
                "remindAt", Map.of("type", "string", "description",
                    "提醒时间。格式同 dueDate，支持绝对和相对时间"),
                "visibility", Map.of("type", "string", "enum", List.of("private", "team", "org"),
                    "description", "可见范围: private=仅自己和负责人, team=部门内, org=全员"),
                "assignee", Map.of("type", "string", "description", "负责人，默认当前用户")
            ),
            "required", List.of("title")
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String title = stringParam(params, "title", "");
        if (title.isBlank()) {
            return ToolResult.fail("TODO001_TITLE_REQUIRED", "待办标题不能为空");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime dueDate = parseDateTime(optionalString(params, "dueDate"), now);
        LocalDateTime remindAt = parseDateTime(optionalString(params, "remindAt"), now);

        String assignee = stringParam(params, "assignee", "");
        AgentTodo todo = todoService.create(
            title,
            optionalString(params, "description"),
            assignee.isEmpty() || "current-user".equals(assignee) ? null : assignee,
            dueDate,
            remindAt,
            stringParam(params, "visibility", "private"),
            null
        );

        return ToolResult.ok(Map.of(
            "todo", toMap(todo),
            "calendarLinked", false,
            "reminderScheduled", todo.getRemindAt() != null,
            "rbacScope", todo.getVisibility()
        ));
    }

    // ── 时间解析：绝对时间 + 相对时间 ──────────────────────────

    LocalDateTime parseDateTime(String value, LocalDateTime now) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();

        // 绝对时间: yyyy-MM-dd HH:mm:ss
        try {
            return LocalDateTime.parse(trimmed, FMT);
        } catch (Exception ignored) {
        }

        // 绝对时间: ISO 格式
        try {
            return LocalDateTime.parse(trimmed);
        } catch (Exception ignored) {
        }

        // 相对时间
        LocalDateTime resolved = resolveRelative(trimmed, now);
        if (resolved != null) {
            return resolved;
        }

        // 只给了日期部分: yyyy-MM-dd
        try {
            return LocalDate.parse(trimmed).atTime(LocalTime.NOON);
        } catch (Exception ignored) {
        }

        return null;
    }

    private LocalDateTime resolveRelative(String value, LocalDateTime now) {
        String lower = value.toLowerCase().trim();

        // "明天" / "tomorrow"
        if (lower.equals("明天") || lower.equals("tomorrow")) {
            return now.plusDays(1).withHour(9).withMinute(0).withSecond(0);
        }
        // "后天" / "day after tomorrow"
        if (lower.equals("后天") || lower.equals("day after tomorrow")) {
            return now.plusDays(2).withHour(9).withMinute(0).withSecond(0);
        }

        // "N分钟后" / "in N min"
        Matcher minMatcher = RELATIVE_MINUTES.matcher(lower);
        if (minMatcher.find()) {
            String g1 = minMatcher.group(1);
            String g2 = minMatcher.group(2);
            int minutes = Integer.parseInt(g1 != null ? g1 : g2);
            return now.plusMinutes(minutes);
        }

        // "N小时后" / "in N hour"
        Matcher hourMatcher = RELATIVE_HOURS.matcher(lower);
        if (hourMatcher.find()) {
            String g1 = hourMatcher.group(1);
            String g2 = hourMatcher.group(2);
            int hours = Integer.parseInt(g1 != null ? g1 : g2);
            return now.plusHours(hours);
        }

        // "N天后" / "in N day"
        Matcher dayMatcher = RELATIVE_DAYS.matcher(lower);
        if (dayMatcher.find()) {
            String g1 = dayMatcher.group(1);
            String g2 = dayMatcher.group(2);
            int days = Integer.parseInt(g1 != null ? g1 : g2);
            return now.plusDays(days).withHour(9).withMinute(0).withSecond(0);
        }

        return null;
    }

    // ── 辅助方法 ──────────────────────────────────────────────

    private Map<String, Object> toMap(AgentTodo todo) {
        return Map.of(
            "id", todo.getId(),
            "title", todo.getTitle() != null ? todo.getTitle() : "",
            "assignee", todo.getAssigneeUserId() != null ? todo.getAssigneeUserId() : "",
            "dueDate", todo.getDueDate() != null ? todo.getDueDate().format(FMT) : "",
            "remindAt", todo.getRemindAt() != null ? todo.getRemindAt().format(FMT) : "",
            "visibility", todo.getVisibility() != null ? todo.getVisibility() : "private",
            "status", statusLabel(todo.getStatus()),
            "createdAt", todo.getCreateTime() != null ? todo.getCreateTime().format(FMT) : ""
        );
    }

    private String statusLabel(Integer status) {
        if (status == null) return "open";
        return switch (status) {
            case 0 -> "open";
            case 1 -> "in_progress";
            case 2 -> "done";
            case 3 -> "cancelled";
            default -> "open";
        };
    }

    private String stringParam(Map<String, Object> params, String key, String defaultValue) {
        Object value = params != null ? params.get(key) : null;
        return value == null || value.toString().isBlank() ? defaultValue : value.toString().trim();
    }

    private String optionalString(Map<String, Object> params, String key) {
        String value = stringParam(params, key, "");
        return value.isBlank() ? null : value;
    }
}
