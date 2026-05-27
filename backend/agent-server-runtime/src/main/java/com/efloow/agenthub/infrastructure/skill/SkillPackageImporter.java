package com.efloow.agenthub.infrastructure.skill;

import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.infrastructure.skill.SkillMdParser.ParsedSkillMd;
import com.efloow.agenthub.system.dto.SkillUpsertRequest;
import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.service.SkillRegistryService;
import com.efloow.agenthub.system.service.SkillResourceService;
import com.efloow.agenthub.system.service.SkillResourceService.ImportedResource;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class SkillPackageImporter {

    private static final Logger log = LoggerFactory.getLogger(SkillPackageImporter.class);

    private final SkillMdParser skillMdParser;
    private final SkillRegistryService skillRegistryService;
    private final SkillResourceService skillResourceService;

    public SkillPackageImporter(
            SkillMdParser skillMdParser,
            SkillRegistryService skillRegistryService,
            SkillResourceService skillResourceService
    ) {
        this.skillMdParser = skillMdParser;
        this.skillRegistryService = skillRegistryService;
        this.skillResourceService = skillResourceService;
    }

    @Transactional
    public String importFile(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        byte[] bytes = file.getBytes();
        if (filename.toLowerCase().endsWith(".zip")) {
            return importZip(bytes);
        }
        return importMarkdown(new String(bytes, StandardCharsets.UTF_8));
    }

    @Transactional
    public String importMarkdown(String raw) {
        ParsedSkillMd parsed = skillMdParser.parse(raw);
        SkillUpsertRequest request = buildUpsertRequest(parsed);
        String id = skillRegistryService.createFromParsed(
                request,
                skillMdParser.frontmatterToJson(parsed.frontmatter()),
                skillMdParser.pathsToJson(parsed.paths()),
                skillMdParser.policyToJson(parsed.policy())
        );
        log.info("Skill Markdown 已导入: id={}, code={}", id, parsed.name());
        return id;
    }

    @Transactional
    public String importZip(byte[] zipBytes) throws IOException {
        Map<String, byte[]> entries = readZipEntries(zipBytes);
        String skillMdPath = findSkillMdPath(entries.keySet());
        if (skillMdPath == null) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "ZIP 包内未找到 SKILL.md");
        }
        String raw = new String(entries.get(skillMdPath), StandardCharsets.UTF_8);
        ParsedSkillMd parsed = skillMdParser.parse(raw);
        SkillUpsertRequest request = buildUpsertRequest(parsed);
        String id = skillRegistryService.createFromParsed(
                request,
                skillMdParser.frontmatterToJson(parsed.frontmatter()),
                skillMdParser.pathsToJson(parsed.paths()),
                skillMdParser.policyToJson(parsed.policy())
        );
        SystemSkill skill = skillRegistryService.requireSkill(id);
        String prefix = skillMdPath.contains("/")
                ? skillMdPath.substring(0, skillMdPath.lastIndexOf('/') + 1)
                : "";
        List<ImportedResource> resources = new ArrayList<>();
        for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
            String path = entry.getKey();
            if (path.equals(skillMdPath) || path.endsWith("/")) {
                continue;
            }
            String relative = prefix.isEmpty() ? path : stripPrefix(path, prefix);
            if (relative == null || relative.isBlank() || "SKILL.md".equals(relative)) {
                continue;
            }
            resources.add(new ImportedResource(relative, entry.getValue()));
        }
        skillResourceService.replaceAllForSkill(skill, resources);
        log.info("Skill ZIP 已导入: id={}, code={}, resources={}", id, parsed.name(), resources.size());
        return id;
    }

    public byte[] exportZip(SystemSkill skill, List<ImportedResource> resources, String contentMd) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            String skillMd = buildSkillMdExport(skill, contentMd);
            writeEntry(zos, skill.getSkillCode() + "/SKILL.md", skillMd.getBytes(StandardCharsets.UTF_8));
            for (ImportedResource resource : resources) {
                String path = skill.getSkillCode() + "/" + resource.path();
                writeEntry(zos, path, resource.content());
            }
        }
        return baos.toByteArray();
    }

    private SkillUpsertRequest buildUpsertRequest(ParsedSkillMd parsed) {
        SkillUpsertRequest request = new SkillUpsertRequest();
        request.setSkillCode(parsed.name());
        request.setSkillName(parsed.name());
        request.setDescription(parsed.description());
        request.setContentMd(parsed.body());
        request.setPathsJson(parsed.paths());
        request.setPolicyJson(parsed.policy());
        if (parsed.disableModelInvocation() != null) {
            request.setAutoInvoke(!parsed.disableModelInvocation());
        }
        if (parsed.context() != null) {
            request.setContextMode(parsed.context());
        }
        return request;
    }

    private String buildSkillMdExport(SystemSkill skill, String contentMd) {
        StringBuilder sb = new StringBuilder();
        sb.append("---\n");
        sb.append("name: ").append(skill.getSkillCode()).append('\n');
        sb.append("description: ").append(escapeYaml(skill.getDescription())).append('\n');
        if (skill.getPathsJson() != null && !skill.getPathsJson().isBlank()) {
            sb.append("paths:\n");
            for (String path : parsePathsJson(skill.getPathsJson())) {
                sb.append("  - \"").append(path).append("\"\n");
            }
        }
        if (skill.getAutoInvoke() != null && skill.getAutoInvoke() == 0) {
            sb.append("disable-model-invocation: true\n");
        }
        if ("fork".equals(skill.getContextMode())) {
            sb.append("context: fork\n");
        }
        sb.append("---\n\n");
        if (contentMd != null) {
            sb.append(contentMd);
        }
        return sb.toString();
    }

    private Map<String, byte[]> readZipEntries(byte[] zipBytes) throws IOException {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }
                String name = SkillResourceService.normalizePath(entry.getName());
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                zis.transferTo(baos);
                entries.put(name, baos.toByteArray());
            }
        }
        return entries;
    }

    private String findSkillMdPath(java.util.Set<String> paths) {
        for (String path : paths) {
            if ("SKILL.md".equals(path) || path.endsWith("/SKILL.md")) {
                return path;
            }
        }
        return null;
    }

    private String stripPrefix(String path, String prefix) {
        if (path.startsWith(prefix)) {
            return path.substring(prefix.length());
        }
        return path;
    }

    private void writeEntry(ZipOutputStream zos, String path, byte[] content) throws IOException {
        ZipEntry entry = new ZipEntry(path);
        zos.putNextEntry(entry);
        zos.write(content);
        zos.closeEntry();
    }

    private List<String> parsePathsJson(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
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
