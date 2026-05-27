package com.efloow.agenthub.system.controller;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.entity.AgentTodo;
import com.efloow.agenthub.system.service.TodoService;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/todos")
public class TodoController {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    @GetMapping
    public R<List<AgentTodo>> list(
            @RequestParam(required = false) String assignee,
            @RequestParam(required = false) Integer status
    ) {
        return R.ok(todoService.listMine(assignee, status));
    }

    @GetMapping("/{id}")
    public R<AgentTodo> get(@PathVariable String id) {
        return R.ok(todoService.get(id));
    }

    @PostMapping
    public R<Map<String, String>> create(@RequestBody Map<String, Object> body) {
        AgentTodo todo = todoService.create(
                stringParam(body, "title"),
                stringParam(body, "description"),
                stringParam(body, "assigneeUserId"),
                parseDateTime(stringParam(body, "dueDate")),
                parseDateTime(stringParam(body, "remindAt")),
                stringParam(body, "visibility", "private"),
                aclEntries(body)
        );
        return R.ok(Map.of(
                "id", todo.getId(),
                "calendarLinked", "false",
                "reminderScheduled", todo.getRemindAt() != null ? "true" : "false",
                "rbacScope", todo.getVisibility()
        ));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody AgentTodo update) {
        todoService.update(id, update);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        todoService.delete(id);
        return R.ok(null);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> aclEntries(Map<String, Object> body) {
        Object acl = body != null ? body.get("acl") : null;
        if (acl instanceof List) {
            return (List<Map<String, String>>) acl;
        }
        return null;
    }

    private String stringParam(Map<String, Object> params, String key) {
        Object value = params != null ? params.get(key) : null;
        return value != null ? value.toString() : null;
    }

    private String stringParam(Map<String, Object> params, String key, String defaultValue) {
        String value = stringParam(params, key);
        return value != null && !value.isBlank() ? value : defaultValue;
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, FMT);
        } catch (Exception e) {
            return LocalDateTime.parse(value);
        }
    }
}
