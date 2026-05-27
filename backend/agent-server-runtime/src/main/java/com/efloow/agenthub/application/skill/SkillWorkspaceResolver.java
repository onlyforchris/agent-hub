package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.common.exception.BusinessException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

@Service
public class SkillWorkspaceResolver {

    private final SkillResourceMaterializer materializer;
    private final SkillSessionHolder sessionHolder;

    public SkillWorkspaceResolver(SkillResourceMaterializer materializer, SkillSessionHolder sessionHolder) {
        this.materializer = materializer;
        this.sessionHolder = sessionHolder;
    }

    public Path resolveWorkspace(String skillCode) {
        String sessionId = currentSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return materializer.skillRoot(skillCode).resolve("workspace");
        }
        Path workspace = materializer.sessionWorkspace(sessionId, skillCode);
        try {
            Files.createDirectories(workspace.resolve("input"));
            Files.createDirectories(workspace.resolve("output"));
            Files.createDirectories(workspace.resolve("unpacked"));
        } catch (Exception e) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "无法创建工作区: " + e.getMessage());
        }
        return workspace;
    }

    public Path resolveSkillRoot(String skillCode) {
        String sessionId = currentSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            return materializer.skillRoot(skillCode);
        }
        return materializer.sessionRoot(sessionId, skillCode);
    }

    public String currentSkillCode() {
        if (sessionHolder.currentSkill() != null) {
            return sessionHolder.currentSkill().skillCode();
        }
        return null;
    }

    public Path resolveRelativePath(String skillCode, String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw new BusinessException("T002_INVALID_PARAMS", "路径不能为空");
        }
        String normalized = relativePath.replace('\\', '/');
        if (normalized.contains("..") || normalized.startsWith("/")) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "路径非法: " + relativePath);
        }
        Path base = normalized.startsWith("workspace/") || normalized.startsWith("scripts/")
                ? resolveSkillRoot(skillCode)
                : resolveWorkspace(skillCode);
        String rel = normalized.startsWith("workspace/") ? normalized.substring("workspace/".length()) : normalized;
        if (normalized.startsWith("scripts/")) {
            base = resolveSkillRoot(skillCode);
            rel = normalized;
        } else if (!normalized.startsWith("scripts/") && !normalized.startsWith("workspace/")) {
            rel = normalized;
        }
        Path resolved = base.resolve(rel).normalize();
        Path root = resolveSkillRoot(skillCode).normalize();
        if (!resolved.startsWith(root)) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "路径越界: " + relativePath);
        }
        return resolved;
    }

    private String currentSessionId() {
        return MDC.get("sessionId");
    }
}
