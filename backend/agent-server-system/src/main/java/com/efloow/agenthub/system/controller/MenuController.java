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
@RequestMapping("/api/rbac/menus")
public class MenuController {

    private final RbacService rbacService;

    public MenuController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping("/tree")
    public R<List<Map<String, Object>>> tree() {
        rbacService.assertPermission("system:menu:view");
        return R.ok(rbacService.menuTree(false));
    }

    @GetMapping("/routes")
    public R<List<Map<String, Object>>> routes() {
        return R.ok(rbacService.menuTree(true));
    }

    @GetMapping
    public R<List<Map<String, Object>>> list() {
        rbacService.assertPermission("system:menu:view");
        return R.ok(rbacService.listMenus());
    }

    @PostMapping
    public R<String> add(@RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:menu:add");
        return R.ok(rbacService.createMenu(body));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:menu:edit");
        rbacService.updateMenu(id, body);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        rbacService.assertPermission("system:menu:delete");
        rbacService.deleteMenu(id);
        return R.ok(null);
    }
}
