package com.efloow.agenthub.infrastructure.tool.document;

import com.efloow.agenthub.application.skill.SkillWorkspaceResolver;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.infrastructure.tool.cli.CliProcessRunner;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DocumentExtractTextTool extends AbstractDocumentCliTool {

    public DocumentExtractTextTool(CliProcessRunner cliProcessRunner, SkillWorkspaceResolver workspaceResolver) {
        super(cliProcessRunner, workspaceResolver);
    }

    @Override
    public String toolKey() {
        return "document.extract-text";
    }

    @Override
    public String description() {
        return "从 docx/pdf 等文档提取纯文本";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "required", List.of("inputPath"),
                "properties", Map.of(
                        "inputPath", Map.of("type", "string"),
                        "format", Map.of("type", "string")
                )
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String skillCode = resolveSkillCode(params);
        Path skillRoot = workspaceResolver.resolveSkillRoot(skillCode);
        Path input = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "inputPath"));
        String lower = input.getFileName().toString().toLowerCase(Locale.ROOT);
        List<String> argv;
        if (lower.endsWith(".pdf")) {
            argv = List.of("pdftotext", input.toString(), "-");
        } else if (lower.endsWith(".docx") || lower.endsWith(".pptx") || lower.endsWith(".xlsx")) {
            argv = List.of(
                    pythonCommand(),
                    skillRoot.resolve("scripts/extract_text.py").toString(),
                    input.toString()
            );
        } else {
            return ToolResult.fail("T002_INVALID_PARAMS", "不支持的文档格式: " + lower);
        }
        ToolResult result = runCli(params, argv, skillRoot, null);
        if (result.success() && result.data() instanceof Map<?, ?> map && map.get("stdout") != null) {
            Map<String, Object> data = new LinkedHashMap<>();
            map.forEach((key, value) -> data.put(String.valueOf(key), value));
            data.put("text", map.get("stdout"));
            return ToolResult.ok(data);
        }
        return result;
    }

    @Override
    protected String defaultSkillCode() {
        return "docx";
    }

    private String pythonCommand() {
        return System.getProperty("os.name", "").toLowerCase().contains("win") ? "python" : "python3";
    }
}
