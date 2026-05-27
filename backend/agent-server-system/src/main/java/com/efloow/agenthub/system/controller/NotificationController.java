package com.efloow.agenthub.system.controller;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.entity.AgentNotificationTemplate;
import com.efloow.agenthub.system.service.NotificationService;
import com.efloow.agenthub.system.service.RbacService;
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
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final RbacService rbacService;

    public NotificationController(NotificationService notificationService, RbacService rbacService) {
        this.notificationService = notificationService;
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<Object> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return R.ok(notificationService.listMyNotifications(page, pageSize));
    }

    @GetMapping("/unread-count")
    public R<Long> unreadCount() {
        return R.ok(notificationService.unreadCount());
    }

    @PutMapping("/{id}/read")
    public R<Void> markRead(@PathVariable String id) {
        notificationService.markRead(id);
        return R.ok(null);
    }

    @PutMapping("/read-all")
    public R<Void> markAllRead() {
        notificationService.markAllRead();
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        notificationService.delete(id);
        return R.ok(null);
    }

    @GetMapping("/templates")
    public R<Object> templates() {
        rbacService.assertPermission("notification:template:view");
        return R.ok(notificationService.listTemplates());
    }

    @PostMapping("/templates")
    public R<AgentNotificationTemplate> createTemplate(@RequestBody AgentNotificationTemplate template) {
        rbacService.assertPermission("notification:template:add");
        return R.ok(notificationService.createTemplate(template));
    }

    @PutMapping("/templates/{id}")
    public R<AgentNotificationTemplate> updateTemplate(@PathVariable String id,
                                                        @RequestBody AgentNotificationTemplate template) {
        rbacService.assertPermission("notification:template:edit");
        template.setId(id);
        return R.ok(notificationService.updateTemplate(template));
    }

    @DeleteMapping("/templates/{id}")
    public R<Void> deleteTemplate(@PathVariable String id) {
        rbacService.assertPermission("notification:template:delete");
        notificationService.deleteTemplate(id);
        return R.ok(null);
    }

    @GetMapping("/stats")
    public R<Map<String, Object>> stats() {
        rbacService.assertPermission("notification:stats:view");
        return R.ok(notificationService.getStats());
    }

    @PostMapping
    public R<Map<String, Object>> send(@RequestBody Map<String, Object> body) {
        rbacService.assertPermission("notification:send");
        String templateCode = stringParam(body, "templateCode");
        if (templateCode != null && !templateCode.isBlank()) {
            @SuppressWarnings("unchecked")
            Map<String, String> variables = (Map<String, String>) body.get("variables");
            var notification = notificationService.sendByTemplate(
                    templateCode, variables,
                    stringParam(body, "targetType", "USER"),
                    stringParam(body, "targetId"),
                    stringParam(body, "senderId", "system")
            );
            return R.ok(notification != null ? Map.of("id", notification.getId()) : Map.of());
        }
        var notification = notificationService.send(
                stringParam(body, "title", ""),
                stringParam(body, "content"),
                stringParam(body, "category", "SYSTEM"),
                stringParam(body, "targetType", "USER"),
                stringParam(body, "targetId"),
                stringParam(body, "senderId", "system")
        );
        return R.ok(notification != null ? Map.of("id", notification.getId()) : Map.of());
    }

    private String stringParam(Map<String, Object> params, String key) {
        Object value = params != null ? params.get(key) : null;
        return value != null ? value.toString() : null;
    }

    private String stringParam(Map<String, Object> params, String key, String defaultValue) {
        String value = stringParam(params, key);
        return value != null && !value.isBlank() ? value : defaultValue;
    }
}
