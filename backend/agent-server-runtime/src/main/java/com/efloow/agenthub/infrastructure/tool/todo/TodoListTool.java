package com.efloow.agenthub.infrastructure.tool.todo;

import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.system.entity.AgentTodo;
import com.efloow.agenthub.system.service.TodoService;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class TodoListTool implements ToolHandler {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final TodoService todoService;

    public TodoListTool(TodoService todoService) {
        this.todoService = todoService;
    }

    @Override
    public String toolKey() {
        return "todo.list";
    }

    @Override
    public String description() {
        return "查看当前用户待办列表";
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
                "assignee", Map.of("type", "string"),
                "status", Map.of("type", "string", "enum", List.of("open", "done", "all"))
            ),
            "required", List.of()
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String assignee = stringParam(params, "assignee", "current-user");
        String statusStr = stringParam(params, "status", "open");
        Integer statusFilter = toStatusFilter(statusStr);

        List<Map<String, Object>> todos = todoService.listMine(assignee, statusFilter).stream()
            .map(this::toMap)
            .toList();

        return ToolResult.ok(Map.of(
            "assignee", assignee,
            "status", statusStr,
            "count", todos.size(),
            "items", todos
        ));
    }

    private Map<String, Object> toMap(AgentTodo todo) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", todo.getId());
        map.put("title", todo.getTitle());
        map.put("assignee", todo.getAssigneeUserId() != null ? todo.getAssigneeUserId() : "");
        map.put("dueDate", todo.getDueDate() != null ? todo.getDueDate().format(FMT) : "");
        map.put("remindAt", todo.getRemindAt() != null ? todo.getRemindAt().format(FMT) : "");
        map.put("visibility", todo.getVisibility());
        map.put("status", statusLabel(todo.getStatus()));
        map.put("createdAt", todo.getCreateTime() != null ? todo.getCreateTime().format(FMT) : "");
        return map;
    }

    private String statusLabel(Integer status) {
        if (status == null) {
            return "open";
        }
        return switch (status) {
            case 0 -> "open";
            case 1 -> "in_progress";
            case 2 -> "done";
            case 3 -> "cancelled";
            default -> "open";
        };
    }

    private Integer toStatusFilter(String statusStr) {
        if (statusStr == null || "all".equalsIgnoreCase(statusStr)) {
            return null;
        }
        return switch (statusStr) {
            case "open" -> 0;
            case "done" -> 2;
            default -> null;
        };
    }

    private String stringParam(Map<String, Object> params, String key, String defaultValue) {
        Object value = params != null ? params.get(key) : null;
        return value == null || value.toString().isBlank() ? defaultValue : value.toString().trim();
    }
}
