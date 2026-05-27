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
@RequestMapping("/api/rbac/roles")
public class RoleController {

    private final RbacService rbacService;

    public RoleController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<List<Map<String, Object>>> list() {
        rbacService.assertPermission("system:role:view");
        return R.ok(rbacService.listRoles());
    }

    @PostMapping
    public R<String> add(@RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:role:add");
        return R.ok(rbacService.createRole(body));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:role:edit");
        rbacService.updateRole(id, body);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        rbacService.assertPermission("system:role:delete");
        rbacService.deleteRole(id);
        return R.ok(null);
    }

    @PostMapping("/{roleId}/menus")
    public R<Void> assignMenus(@PathVariable String roleId, @RequestBody List<String> menuIds) {
        rbacService.assertPermission("system:role:grant");
        rbacService.assignRoleMenus(roleId, menuIds);
        return R.ok(null);
    }

    @GetMapping("/{roleId}/menus")
    public R<List<String>> menuIds(@PathVariable String roleId) {
        rbacService.assertPermission("system:role:view");
        return R.ok(rbacService.menuIdsByRole(roleId));
    }

    @PostMapping("/{roleId}/resources")
    public R<Void> assignResources(@PathVariable String roleId, @RequestBody List<String> resourceIds) {
        rbacService.assertPermission("system:role:grant");
        rbacService.assignRoleResources(roleId, resourceIds);
        return R.ok(null);
    }

    @GetMapping("/{roleId}/resources")
    public R<List<String>> resourceIds(@PathVariable String roleId) {
        rbacService.assertPermission("system:role:view");
        return R.ok(rbacService.resourceIdsByRole(roleId));
    }

    @PostMapping("/{roleId}/agents")
    public R<Void> assignAgents(@PathVariable String roleId, @RequestBody List<String> agentIds) {
        rbacService.assertPermission("system:role:grant");
        rbacService.assignRoleAgents(roleId, agentIds);
        return R.ok(null);
    }

    @GetMapping("/{roleId}/agents")
    public R<List<String>> agentIds(@PathVariable String roleId) {
        rbacService.assertPermission("system:role:view");
        return R.ok(rbacService.agentIdsByRole(roleId));
    }
}
