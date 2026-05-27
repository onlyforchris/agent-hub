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
public class DocumentPdfToImagesTool extends AbstractDocumentCliTool {

    public DocumentPdfToImagesTool(CliProcessRunner cliProcessRunner, SkillWorkspaceResolver workspaceResolver) {
        super(cliProcessRunner, workspaceResolver);
    }

    @Override
    public String toolKey() {
        return "document.pdf.to-images";
    }

    @Override
    public String description() {
        return "将 PDF 页面渲染为 PNG 图片";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "required", List.of("inputPath", "outputPrefix"),
                "properties", Map.of(
                        "inputPath", Map.of("type", "string"),
                        "outputPrefix", Map.of("type", "string"),
                        "dpi", Map.of("type", "integer")
                )
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String skillCode = resolveSkillCode(params);
        Path skillRoot = workspaceResolver.resolveSkillRoot(skillCode);
        Path input = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "inputPath"));
        Path outputPrefix = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "outputPrefix"));
        try {
            Files.createDirectories(outputPrefix.getParent());
        } catch (Exception e) {
            return ToolResult.fail("T010_CLI_NOT_ALLOWED", "无法创建输出目录");
        }
        List<String> argv = new ArrayList<>();
        argv.add("pdftoppm");
        if (params.get("dpi") instanceof Number dpi) {
            argv.add("-rx");
            argv.add(String.valueOf(dpi.intValue()));
            argv.add("-ry");
            argv.add(String.valueOf(dpi.intValue()));
        }
        argv.add("-png");
        argv.add(input.toString());
        argv.add(outputPrefix.toString());
        return runCli(params, argv, skillRoot, null);
    }

    @Override
    protected String defaultSkillCode() {
        return "pdf";
    }
}
