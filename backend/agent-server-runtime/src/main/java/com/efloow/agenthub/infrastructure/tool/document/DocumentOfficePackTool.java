package com.efloow.agenthub.infrastructure.tool.document;

import com.efloow.agenthub.application.skill.SkillWorkspaceResolver;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.infrastructure.tool.cli.CliProcessRunner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DocumentOfficePackTool extends AbstractDocumentCliTool {

    public DocumentOfficePackTool(CliProcessRunner cliProcessRunner, SkillWorkspaceResolver workspaceResolver) {
        super(cliProcessRunner, workspaceResolver);
    }

    @Override
    public String toolKey() {
        return "document.office.pack";
    }

    @Override
    public String description() {
        return "将解压后的 Office XML 目录重新打包为 .docx/.pptx/.xlsx";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "required", List.of("inputDir", "outputPath"),
                "properties", Map.of(
                        "inputDir", Map.of("type", "string"),
                        "outputPath", Map.of("type", "string"),
                        "originalPath", Map.of("type", "string")
                )
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String skillCode = resolveSkillCode(params);
        Path skillRoot = workspaceResolver.resolveSkillRoot(skillCode);
        Path inputDir = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "inputDir"));
        Path outputPath = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "outputPath"));
        try {
            Files.createDirectories(outputPath.getParent());
        } catch (Exception e) {
            return ToolResult.fail("T010_CLI_NOT_ALLOWED", "无法创建输出路径");
        }
        List<String> argv = new ArrayList<>(List.of(
                pythonCommand(),
                skillRoot.resolve("scripts/office/pack.py").toString(),
                inputDir.toString(),
                outputPath.toString()
        ));
        if (params.get("originalPath") instanceof String original && !original.isBlank()) {
            argv.add(workspaceResolver.resolveRelativePath(skillCode, original).toString());
        }
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
