package com.efloow.agenthub.infrastructure.skill;

import com.efloow.agenthub.application.skill.SkillEmbeddingSync;
import com.efloow.agenthub.application.skill.SkillRegistrySync;
import com.efloow.agenthub.application.skill.SkillResourceMaterializer;
import com.efloow.agenthub.system.entity.AgentSkillMount;
import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.mapper.AgentSkillMountMapper;
import com.efloow.agenthub.system.service.SkillRegistryService;
import com.efloow.agenthub.system.service.SkillResourceService;
import com.efloow.agenthub.system.service.SkillResourceService.ImportedResource;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

/**
 * P4d: 从 classpath 引导 Document Skills (docx/pdf/pptx/xlsx) 与共享 scripts。
 */
@Component
public class DocumentSkillBootstrap {

    private static final Logger log = LoggerFactory.getLogger(DocumentSkillBootstrap.class);

    private static final Set<String> DOCUMENT_SKILLS = Set.of("docx", "pdf", "pptx", "xlsx");

    private static final List<String> SHARED_SCRIPTS = List.of(
            "scripts/office/unpack.py",
            "scripts/office/pack.py",
            "scripts/office/validate.py",
            "scripts/recalc.py",
            "scripts/extract_text.py"
    );

    private final SkillRegistryService skillRegistryService;
    private final SkillResourceService skillResourceService;
    private final SkillMdParser skillMdParser;
    private final SkillResourceMaterializer skillResourceMaterializer;
    private final AgentSkillMountMapper mountMapper;
    private final SkillRegistrySync skillRegistrySync;
    private final SkillEmbeddingSync skillEmbeddingSync;

    public DocumentSkillBootstrap(
            SkillRegistryService skillRegistryService,
            SkillResourceService skillResourceService,
            SkillMdParser skillMdParser,
            SkillResourceMaterializer skillResourceMaterializer,
            AgentSkillMountMapper mountMapper,
            SkillRegistrySync skillRegistrySync,
            SkillEmbeddingSync skillEmbeddingSync
    ) {
        this.skillRegistryService = skillRegistryService;
        this.skillResourceService = skillResourceService;
        this.skillMdParser = skillMdParser;
        this.skillResourceMaterializer = skillResourceMaterializer;
        this.mountMapper = mountMapper;
        this.skillRegistrySync = skillRegistrySync;
        this.skillEmbeddingSync = skillEmbeddingSync;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void bootstrapDocumentSkills() {
        for (String skillCode : DOCUMENT_SKILLS) {
            try {
                ensureSkill(skillCode);
            } catch (Exception e) {
                log.warn("Document Skill 引导失败: code={}, reason={}", skillCode, e.getMessage());
            }
        }
        skillRegistrySync.reload();
    }

    private void ensureSkill(String skillCode) throws IOException {
        SystemSkill existing = skillRegistryService.getByCode(skillCode);
        if (existing != null) {
            return;
        }
        String skillMd = readClasspath("skills/" + skillCode + "/SKILL.md");
        var parsed = skillMdParser.parse(skillMd);
        var request = new com.efloow.agenthub.system.dto.SkillUpsertRequest();
        request.setSkillCode(skillCode);
        request.setSkillName(parsed.name());
        request.setDescription(parsed.description());
        request.setContentMd(parsed.body());
        request.setPathsJson(parsed.paths());
        request.setPolicyJson(parsed.policy());
        request.setCategory("document");
        if (parsed.disableModelInvocation() != null) {
            request.setAutoInvoke(!parsed.disableModelInvocation());
        }
        if (parsed.context() != null) {
            request.setContextMode(parsed.context());
        }
        String id = skillRegistryService.createFromParsedInternal(
                request,
                skillMdParser.frontmatterToJson(parsed.frontmatter()),
                skillMdParser.pathsToJson(parsed.paths()),
                skillMdParser.policyToJson(parsed.policy())
        );
        SystemSkill skill = skillRegistryService.requireSkill(id);
        skillResourceService.replaceAllForSkill(skill, loadSharedScripts());
        skillRegistryService.publishInternal(id);
        SystemSkill published = skillRegistryService.requireSkill(id);
        skillResourceMaterializer.materializePublished(published);
        skillEmbeddingSync.indexPublished(published);
        ensureMount("document", skill, skillCode);
        log.info("Document Skill 已引导: code={}", skillCode);
    }

    private void ensureMount(String agentId, SystemSkill skill, String skillCode) {
        AgentSkillMount existing = mountMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AgentSkillMount>()
                        .eq(AgentSkillMount::getAgentId, agentId)
                        .eq(AgentSkillMount::getSkillId, skill.getId())
                        .ne(AgentSkillMount::getStatus, 2)
                        .last("LIMIT 1")
        );
        if (existing != null) {
            return;
        }
        AgentSkillMount mount = new AgentSkillMount();
        mount.setId("asm-document-" + skillCode);
        mount.setAgentId(agentId);
        mount.setSkillId(skill.getId());
        mount.setIsDefault("docx".equals(skillCode) ? 1 : 0);
        mount.setSortOrder(switch (skillCode) {
            case "docx" -> 10;
            case "pdf" -> 20;
            case "pptx" -> 30;
            case "xlsx" -> 40;
            default -> 50;
        });
        mount.setStatus(1);
        mount.setCreateBy("system");
        mountMapper.insert(mount);
    }

    private List<ImportedResource> loadSharedScripts() throws IOException {
        List<ImportedResource> resources = new ArrayList<>();
        for (String path : SHARED_SCRIPTS) {
            String content = readClasspath("skills/_shared/" + path);
            resources.add(new ImportedResource(path, content.getBytes(StandardCharsets.UTF_8)));
        }
        return resources;
    }

    private String readClasspath(String path) throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        Resource resource = resolver.getResource("classpath:" + path);
        if (!resource.exists()) {
            throw new IOException("classpath 资源不存在: " + path);
        }
        try (InputStream in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
