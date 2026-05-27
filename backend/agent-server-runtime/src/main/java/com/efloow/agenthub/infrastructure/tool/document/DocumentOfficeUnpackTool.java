package com.efloow.agenthub.infrastructure.tool.document;

import com.efloow.agenthub.application.skill.SkillWorkspaceResolver;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.infrastructure.tool.cli.CliProcessRunner;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DocumentOfficeUnpackTool extends AbstractDocumentCliTool {

    public DocumentOfficeUnpackTool(CliProcessRunner cliProcessRunner, SkillWorkspaceResolver workspaceResolver) {
        super(cliProcessRunner, workspaceResolver);
    }

    @Override
    public String toolKey() {
        return "document.office.unpack";
    }

    @Override
    public String description() {
        return "解压 Office Open XML 文档 (.docx/.pptx/.xlsx) 到目录";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "required", List.of("inputPath", "outputDir"),
                "properties", Map.of(
                        "inputPath", Map.of("type", "string"),
                        "outputDir", Map.of("type", "string"),
                        "mergeRuns", Map.of("type", "boolean")
                )
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String skillCode = resolveSkillCode(params);
        Path skillRoot = workspaceResolver.resolveSkillRoot(skillCode);
        Path input = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "inputPath"));
        Path outputDir = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "outputDir"));
        try {
            Files.createDirectories(outputDir);
        } catch (Exception e) {
            return ToolResult.fail("T010_CLI_NOT_ALLOWED", "无法创建输出目录");
        }
        Path script = skillRoot.resolve("scripts/office/unpack.py");
        List<String> argv = List.of(
                pythonCommand(),
                script.toString(),
                input.toString(),
                outputDir.toString()
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
