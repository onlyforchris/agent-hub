package com.efloow.agenthub.controller;

import com.efloow.agenthub.application.skill.SkillRegistrySync;
import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.dto.AgentSkillMountDto;
import com.efloow.agenthub.system.dto.AgentSkillMountSyncRequest;
import com.efloow.agenthub.system.service.AgentSkillMountService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agents/{agentId}/skills")
public class AgentSkillMountController {

    private final AgentSkillMountService agentSkillMountService;
    private final SkillRegistrySync skillRegistrySync;

    public AgentSkillMountController(
            AgentSkillMountService agentSkillMountService,
            SkillRegistrySync skillRegistrySync
    ) {
        this.agentSkillMountService = agentSkillMountService;
        this.skillRegistrySync = skillRegistrySync;
    }

    @GetMapping
    public R<List<AgentSkillMountDto>> list(@PathVariable String agentId) {
        return R.ok(agentSkillMountService.listByAgent(agentId));
    }

    @PutMapping
    public R<List<AgentSkillMountDto>> sync(
            @PathVariable String agentId,
            @RequestBody AgentSkillMountSyncRequest request
    ) {
        List<AgentSkillMountDto> mounts = agentSkillMountService.syncMounts(agentId, request);
        skillRegistrySync.reload();
        return R.ok(mounts);
    }
}
