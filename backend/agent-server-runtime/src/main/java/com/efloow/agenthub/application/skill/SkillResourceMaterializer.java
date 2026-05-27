package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.system.entity.SystemSkill;
import com.efloow.agenthub.system.entity.SystemSkillResource;
import com.efloow.agenthub.system.service.SkillResourceService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SkillResourceMaterializer {

    private static final Logger log = LoggerFactory.getLogger(SkillResourceMaterializer.class);

    private final SkillWorkRootProperties workRootProperties;
    private final SkillResourceService skillResourceService;
    private final Map<String, String> pathHashIndex = new ConcurrentHashMap<>();

    public SkillResourceMaterializer(
            SkillWorkRootProperties workRootProperties,
            SkillResourceService skillResourceService
    ) {
        this.workRootProperties = workRootProperties;
        this.skillResourceService = skillResourceService;
    }

    public Path skillRoot(String skillCode) {
        return workRootProperties.workRoot().resolve(skillCode);
    }

    public Path sessionRoot(String sessionId, String skillCode) {
        return workRootProperties.workRoot().resolve(sessionId).resolve(skillCode);
    }

    public Path sessionWorkspace(String sessionId, String skillCode) {
        return sessionRoot(sessionId, skillCode).resolve("workspace");
    }

    public void materializePublished(SystemSkill skill) {
        List<SystemSkillResource> resources = skillResourceService.listRuntimeBySkillId(skill.getId());
        Path root = skillRoot(skill.getSkillCode());
        try {
            Files.createDirectories(root);
            if (skill.getContentMd() != null) {
                Files.writeString(root.resolve("SKILL.md"), skill.getContentMd(), StandardCharsets.UTF_8);
            }
            for (SystemSkillResource resource : resources) {
                materializeResource(root, resource);
            }
            refreshHashIndex(skill.getSkillCode(), root);
            log.info("Skill 资源已物化: code={}, root={}, count={}",
                    skill.getSkillCode(), root, resources.size());
        } catch (IOException e) {
            log.error("Skill 资源物化失败: code={}", skill.getSkillCode(), e);
            throw new RuntimeException("Skill 资源物化失败: " + e.getMessage(), e);
        }
    }

    public void materializeSession(String sessionId, SystemSkill skill) {
        Path sessionRoot = sessionRoot(sessionId, skill.getSkillCode());
        Path publishedRoot = skillRoot(skill.getSkillCode());
        try {
            Files.createDirectories(sessionRoot.resolve("workspace/input"));
            Files.createDirectories(sessionRoot.resolve("workspace/output"));
            Files.createDirectories(sessionRoot.resolve("workspace/unpacked"));
            if (Files.exists(publishedRoot)) {
                copyTree(publishedRoot, sessionRoot);
            } else {
                materializePublished(skill);
                copyTree(publishedRoot, sessionRoot);
            }
            log.info("Skill 会话工作区已就绪: sessionId={}, skillCode={}", sessionId, skill.getSkillCode());
        } catch (IOException e) {
            log.error("Skill 会话工作区创建失败: sessionId={}, skillCode={}", sessionId, skill.getSkillCode(), e);
            throw new RuntimeException("Skill 会话工作区创建失败: " + e.getMessage(), e);
        }
    }

    public String hashForPath(String skillCode, String relativePath) {
        return pathHashIndex.get(skillCode + ":" + relativePath);
    }

    private void materializeResource(Path root, SystemSkillResource resource) throws IOException {
        if (resource.getStorageUri() != null && !resource.getStorageUri().isBlank()) {
            log.warn("storage_uri 暂未实现下载: path={}", resource.getResourcePath());
            return;
        }
        if (resource.getContentText() == null) {
            return;
        }
        Path target = root.resolve(resource.getResourcePath()).normalize();
        if (!target.startsWith(root)) {
            throw new IOException("路径逃逸: " + resource.getResourcePath());
        }
        Files.createDirectories(target.getParent());
        Files.writeString(target, resource.getContentText(), StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    private void copyTree(Path source, Path target) throws IOException {
        if (!Files.exists(source)) {
            return;
        }
        try (var stream = Files.walk(source)) {
            for (Path path : stream.toList()) {
                Path relative = source.relativize(path);
                Path dest = target.resolve(relative);
                if (Files.isDirectory(path)) {
                    Files.createDirectories(dest);
                } else {
                    Files.createDirectories(dest.getParent());
                    Files.copy(path, dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
    }

    private void refreshHashIndex(String skillCode, Path root) throws IOException {
        if (!Files.exists(root)) {
            return;
        }
        try (var stream = Files.walk(root)) {
            for (Path path : stream.filter(Files::isRegularFile).toList()) {
                String relative = root.relativize(path).toString().replace('\\', '/');
                byte[] bytes = Files.readAllBytes(path);
                pathHashIndex.put(skillCode + ":" + relative, sha256(bytes));
            }
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return "sha256:" + HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception e) {
            return "sha256:unknown";
        }
    }
}
