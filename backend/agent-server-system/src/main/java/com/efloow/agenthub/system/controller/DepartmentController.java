package com.efloow.agenthub.system.controller;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.service.RbacService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rbac/departments")
public class DepartmentController {

    private final RbacService rbacService;

    public DepartmentController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping("/tree")
    public R<List<Map<String, Object>>> tree() {
        rbacService.assertPermission("system:dept:view");
        return R.ok(rbacService.departmentTree());
    }

    @GetMapping
    public R<List<Map<String, Object>>> list() {
        rbacService.assertPermission("system:dept:view");
        return R.ok(rbacService.listDepartments());
    }

    @PostMapping
    public R<String> add(@RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:dept:add");
        return R.ok(rbacService.createDepartment(body));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:dept:edit");
        rbacService.updateDepartment(id, body);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        rbacService.assertPermission("system:dept:delete");
        rbacService.deleteDepartment(id);
        return R.ok(null);
    }
}
