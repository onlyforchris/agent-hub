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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rbac/users")
public class UserController {

    private final RbacService rbacService;

    public UserController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<List<Map<String, Object>>> list() {
        rbacService.assertPermission("system:user:view");
        return R.ok(rbacService.listUsers());
    }

    @PostMapping
    public R<String> add(@RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:user:add");
        return R.ok(rbacService.createUser(body));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:user:edit");
        rbacService.updateUser(id, body);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        rbacService.assertPermission("system:user:delete");
        rbacService.deleteUser(id);
        return R.ok(null);
    }

    @PostMapping("/{userId}/roles")
    public R<Void> assignRoles(
            @PathVariable String userId,
            @RequestParam(defaultValue = "SELF") String dataScope,
            @RequestBody List<String> roleIds
    ) {
        rbacService.assertPermission("system:role:grant");
        rbacService.assignUserRoles(userId, roleIds, dataScope);
        return R.ok(null);
    }

    @GetMapping("/{userId}/roles")
    public R<List<String>> roleIds(@PathVariable String userId) {
        rbacService.assertPermission("system:role:view");
        return R.ok(rbacService.roleIdsByUser(userId));
    }
}
