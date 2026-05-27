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
public class DocumentPandocConvertTool extends AbstractDocumentCliTool {

    public DocumentPandocConvertTool(CliProcessRunner cliProcessRunner, SkillWorkspaceResolver workspaceResolver) {
        super(cliProcessRunner, workspaceResolver);
    }

    @Override
    public String toolKey() {
        return "document.pandoc.convert";
    }

    @Override
    public String description() {
        return "使用 pandoc 转换文档格式";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "required", List.of("inputPath", "outputPath"),
                "properties", Map.of(
                        "inputPath", Map.of("type", "string"),
                        "outputPath", Map.of("type", "string"),
                        "extraArgs", Map.of("type", "array")
                )
        );
    }

    @Override
    @SuppressWarnings("unchecked")
    public ToolResult invoke(Map<String, Object> params) {
        String skillCode = resolveSkillCode(params);
        Path skillRoot = workspaceResolver.resolveSkillRoot(skillCode);
        Path input = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "inputPath"));
        Path output = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "outputPath"));
        try {
            Files.createDirectories(output.getParent());
        } catch (Exception e) {
            return ToolResult.fail("T010_CLI_NOT_ALLOWED", "无法创建输出路径");
        }
        List<String> argv = new ArrayList<>();
        argv.add("pandoc");
        argv.add(input.toString());
        argv.add("-o");
        argv.add(output.toString());
        if (params.get("extraArgs") instanceof List<?> extra) {
            for (Object item : extra) {
                if (item != null) {
                    String arg = String.valueOf(item);
                    if (arg.contains(";") || arg.contains("|")) {
                        return ToolResult.fail("T010_CLI_NOT_ALLOWED", "extraArgs 非法");
                    }
                    argv.add(arg);
                }
            }
        }
        return runCli(params, argv, skillRoot, null);
    }

    @Override
    protected String defaultSkillCode() {
        return "docx";
    }
}
