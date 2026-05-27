package com.efloow.agenthub.infrastructure.tool.document;

import com.efloow.agenthub.application.skill.SkillWorkspaceResolver;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.infrastructure.tool.cli.CliProcessRunner;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DocumentOfficeValidateTool extends AbstractDocumentCliTool {

    public DocumentOfficeValidateTool(CliProcessRunner cliProcessRunner, SkillWorkspaceResolver workspaceResolver) {
        super(cliProcessRunner, workspaceResolver);
    }

    @Override
    public String toolKey() {
        return "document.office.validate";
    }

    @Override
    public String description() {
        return "校验 Office Open XML 文档结构";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "required", List.of("targetPath"),
                "properties", Map.of("targetPath", Map.of("type", "string"))
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String skillCode = resolveSkillCode(params);
        Path skillRoot = workspaceResolver.resolveSkillRoot(skillCode);
        Path target = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "targetPath"));
        List<String> argv = List.of(
                pythonCommand(),
                skillRoot.resolve("scripts/office/validate.py").toString(),
                target.toString()
        );
        return runCli(params, argv, skillRoot, null);
    }

    @Override
    protected String defaultSkillCode() {
        return "docx";
    }

    private String pythonCommand() {
        return System.getProperty("os.name", "").toLowerCase().contains("win") ? "python" : "python3";
    }
}
