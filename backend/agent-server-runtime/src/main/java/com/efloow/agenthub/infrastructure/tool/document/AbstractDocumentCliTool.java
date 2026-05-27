package com.efloow.agenthub.infrastructure.tool.document;

import com.efloow.agenthub.application.skill.SkillWorkspaceResolver;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.infrastructure.tool.cli.CliProcessResult;
import com.efloow.agenthub.infrastructure.tool.cli.CliProcessRunner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

abstract class AbstractDocumentCliTool implements ToolHandler {

    protected final CliProcessRunner cliProcessRunner;
    protected final SkillWorkspaceResolver workspaceResolver;

    protected AbstractDocumentCliTool(CliProcessRunner cliProcessRunner, SkillWorkspaceResolver workspaceResolver) {
        this.cliProcessRunner = cliProcessRunner;
        this.workspaceResolver = workspaceResolver;
    }

    protected String resolveSkillCode(Map<String, Object> params) {
        String skillCode = workspaceResolver.currentSkillCode();
        if (skillCode == null && params.get("skillCode") instanceof String code && !code.isBlank()) {
            skillCode = code;
        }
        if (skillCode == null) {
            skillCode = defaultSkillCode();
        }
        if (skillCode == null || skillCode.isBlank()) {
            throw new BusinessException("T002_INVALID_PARAMS", "缺少 skillCode 上下文");
        }
        return skillCode;
    }

    protected String requireString(Map<String, Object> params, String key) {
        Object value = params.get(key);
        if (value == null || String.valueOf(value).isBlank()) {
            throw new BusinessException("T002_INVALID_PARAMS", key + " 不能为空");
        }
        return String.valueOf(value).trim();
    }

    protected ToolResult runCli(
            Map<String, Object> params,
            List<String> argv,
            Path workingDir,
            Long timeoutMs
    ) {
        CliProcessResult result = cliProcessRunner.run(argv, workingDir, buildEnv(workingDir), timeoutMs);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exitCode", result.exitCode());
        data.put("stdout", result.stdout());
        data.put("stderr", result.stderr());
        data.put("durationMs", result.durationMs());
        return ToolResult.ok(data);
    }

    protected Map<String, String> buildEnv(Path workingDir) {
        Path scriptsDir = workingDir;
        while (scriptsDir != null && !Files.exists(scriptsDir.resolve("scripts"))) {
            scriptsDir = scriptsDir.getParent();
        }
        if (scriptsDir == null) {
            return Map.of();
        }
        return Map.of("PYTHONPATH", scriptsDir.resolve("scripts").toString());
    }

    protected abstract String defaultSkillCode();
}
