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
@RequestMapping("/api/agents")
public class AgentAccessController {

    private final RbacService rbacService;

    public AgentAccessController(RbacService rbacService) {
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<List<Map<String, Object>>> authorizedAgents() {
        rbacService.assertPermission("system:agent:view");
        return R.ok(rbacService.listAuthorizedAgents());
    }

    @GetMapping("/all")
    public R<List<Map<String, Object>>> allAgents() {
        rbacService.assertPermission("system:agent:manage");
        return R.ok(rbacService.listAgents());
    }

    @PostMapping
    public R<String> add(@RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:agent:add");
        return R.ok(rbacService.createAgent(body));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        rbacService.assertPermission("system:agent:edit");
        rbacService.updateAgent(id, body);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        rbacService.assertPermission("system:agent:delete");
        rbacService.deleteAgent(id);
        return R.ok(null);
    }
}
