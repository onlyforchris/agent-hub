package com.efloow.agenthub.controller;

import com.efloow.agenthub.application.skill.SkillRegistrySync;
import com.efloow.agenthub.application.skill.SkillEmbeddingSync;
import com.efloow.agenthub.application.skill.SkillResourceMaterializer;
import com.efloow.agenthub.application.skill.SkillRouter;
import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.infrastructure.skill.SkillPackageImporter;
import com.efloow.agenthub.system.dto.SkillDetailDto;
import com.efloow.agenthub.system.dto.SkillResourceDto;
import com.efloow.agenthub.system.dto.SkillResourceUpsertRequest;
import com.efloow.agenthub.system.dto.SkillRouteTestRequest;
import com.efloow.agenthub.system.dto.SkillRouteTestResultDto;
import com.efloow.agenthub.system.dto.SkillSummaryDto;
import com.efloow.agenthub.system.dto.SkillUpsertRequest;
import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.service.RbacService;
import com.efloow.agenthub.system.service.SkillRegistryService;
import com.efloow.agenthub.system.service.SkillResourceService;
import com.efloow.agenthub.system.service.SkillResourceService.ImportedResource;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/skills")
public class SkillController {

    private final SkillRegistryService skillRegistryService;
    private final SkillResourceService skillResourceService;
    private final SkillRegistrySync skillRegistrySync;
    private final SkillResourceMaterializer skillResourceMaterializer;
    private final SkillEmbeddingSync skillEmbeddingSync;
    private final SkillRouter skillRouter;
    private final SkillPackageImporter skillPackageImporter;
    private final RbacService rbacService;

    public SkillController(
            SkillRegistryService skillRegistryService,
            SkillResourceService skillResourceService,
            SkillRegistrySync skillRegistrySync,
            SkillResourceMaterializer skillResourceMaterializer,
            SkillEmbeddingSync skillEmbeddingSync,
            SkillRouter skillRouter,
            SkillPackageImporter skillPackageImporter,
            RbacService rbacService
    ) {
        this.skillRegistryService = skillRegistryService;
        this.skillResourceService = skillResourceService;
        this.skillRegistrySync = skillRegistrySync;
        this.skillResourceMaterializer = skillResourceMaterializer;
        this.skillEmbeddingSync = skillEmbeddingSync;
        this.skillRouter = skillRouter;
        this.skillPackageImporter = skillPackageImporter;
        this.rbacService = rbacService;
    }

    @GetMapping
    public R<List<SkillSummaryDto>> list(@RequestParam(required = false) String agentId) {
        return R.ok(skillRegistryService.listAll(agentId));
    }

    @GetMapping("/catalog")
    public R<List<SkillSummaryDto>> catalog() {
        return R.ok(skillRegistryService.listPublishedCatalog());
    }

    @GetMapping("/{id}")
    public R<SkillDetailDto> detail(@PathVariable String id) {
        return R.ok(skillRegistryService.getDetail(id));
    }

    @PostMapping
    public R<String> create(@RequestBody SkillUpsertRequest request) {
        String id = skillRegistryService.create(request);
        return R.ok(id);
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable String id, @RequestBody SkillUpsertRequest request) {
        skillRegistryService.update(id, request);
        return R.ok(null);
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable String id) {
        skillRegistryService.delete(id);
        skillRegistrySync.reload();
        return R.ok(null);
    }

    @PostMapping("/{id}/publish")
    public R<SkillDetailDto> publish(@PathVariable String id) {
        SkillDetailDto detail = skillRegistryService.publish(id);
        SystemSkill skill = skillRegistryService.requireSkill(id);
        skillResourceMaterializer.materializePublished(skill);
        skillEmbeddingSync.indexPublished(skill);
        skillRegistrySync.reload();
        return R.ok(detail);
    }

    @PostMapping("/import")
    public R<SkillDetailDto> importPackage(@RequestParam("file") MultipartFile file) throws Exception {
        rbacService.assertPermission("system:skill:import");
        String id = skillPackageImporter.importFile(file);
        return R.ok(skillRegistryService.getDetail(id));
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<byte[]> export(
            @PathVariable String id,
            @RequestParam(defaultValue = "markdown") String format
    ) throws Exception {
        rbacService.assertPermission("system:skill:view");
        SystemSkill skill = skillRegistryService.requireSkill(id);
        if ("zip".equalsIgnoreCase(format)) {
            List<ImportedResource> resources = skillResourceService.listRuntimeBySkillId(id).stream()
                    .filter(r -> r.getContentText() != null)
                    .map(r -> new ImportedResource(r.getResourcePath(),
                            r.getContentText().getBytes(StandardCharsets.UTF_8)))
                    .toList();
            byte[] zip = skillPackageImporter.exportZip(skill, resources, skill.getContentMd());
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + skill.getSkillCode() + ".zip\"")
                    .contentType(MediaType.parseMediaType("application/zip"))
                    .body(zip);
        }
        SkillDetailDto detail = skillRegistryService.getDetail(id);
        StringBuilder sb = new StringBuilder();
        sb.append("---\n");
        sb.append("name: ").append(detail.getSkillCode()).append('\n');
        sb.append("description: ").append(escapeYaml(detail.getDescription())).append('\n');
        if (detail.getPathsJson() != null && !detail.getPathsJson().isEmpty()) {
            sb.append("paths:\n");
            for (String path : detail.getPathsJson()) {
                sb.append("  - \"").append(path).append("\"\n");
            }
        }
        if (Boolean.FALSE.equals(detail.getAutoInvoke())) {
            sb.append("disable-model-invocation: true\n");
        }
        if ("fork".equals(detail.getContextMode())) {
            sb.append("context: fork\n");
        }
        sb.append("---\n\n");
        if (detail.getContentMd() != null) {
            sb.append(detail.getContentMd());
        }
        byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + detail.getSkillCode() + "-SKILL.md\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(bytes);
    }

    @GetMapping("/{id}/resources")
    public R<List<SkillResourceDto>> listResources(@PathVariable String id) {
        return R.ok(skillResourceService.listBySkillId(id));
    }

    @PostMapping("/{id}/resources")
    public R<String> createResource(@PathVariable String id, @RequestBody SkillResourceUpsertRequest request) {
        return R.ok(skillResourceService.create(id, request));
    }

    @PutMapping("/{id}/resources/{resourceId}")
    public R<Void> updateResource(
            @PathVariable String id,
            @PathVariable String resourceId,
            @RequestBody SkillResourceUpsertRequest request
    ) {
        skillResourceService.update(id, resourceId, request);
        return R.ok(null);
    }

    @DeleteMapping("/{id}/resources/{resourceId}")
    public R<Void> deleteResource(@PathVariable String id, @PathVariable String resourceId) {
        skillResourceService.delete(id, resourceId);
        return R.ok(null);
    }

    @PostMapping("/test-route")
    public R<SkillRouteTestResultDto> testRoute(@RequestBody SkillRouteTestRequest request) {
        rbacService.assertPermission("system:skill:test-route");
        int topK = request.getTopK() != null ? request.getTopK() : 5;
        return R.ok(skillRouter.testRoute(
                request.getInputText(),
                request.getAgentId(),
                request.getWorkspacePaths(),
                topK
        ));
    }

    @PostMapping("/reload")
    public R<Map<String, Object>> reload() {
        rbacService.assertPermission("system:skill:reload");
        skillRegistrySync.reload();
        Map<String, Object> body = new HashMap<>();
        body.put("reloaded", true);
        body.put("catalogSize", skillRegistrySync.allPublished().size());
        body.put("embeddingReindexed", skillEmbeddingSync.reindexAllPublished());
        return R.ok(body);
    }

    private String escapeYaml(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(":") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\\\"") + "\"";
        }
        return value;
    }
}
