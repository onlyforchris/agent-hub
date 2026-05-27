package com.efloow.agenthub.system.controller;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.service.AuditAccessLogService;
import com.efloow.agenthub.system.service.RbacService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rbac/audit/access")
public class AuditAccessController {

    private final AuditAccessLogService auditAccessLogService;
    private final RbacService rbacService;

    public AuditAccessController(AuditAccessLogService auditAccessLogService, RbacService rbacService) {
        this.auditAccessLogService = auditAccessLogService;
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<List<Map<String, Object>>> list(@RequestParam(defaultValue = "100") int limit) {
        rbacService.assertPermission("audit:view");
        return R.ok(auditAccessLogService.listRecent(limit));
    }
}
