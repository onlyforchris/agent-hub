package com.efloow.agenthub.infrastructure.tool.document;

import com.efloow.agenthub.application.skill.SkillWorkspaceResolver;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.infrastructure.tool.cli.CliProcessRunner;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DocumentXlsxRecalcTool extends AbstractDocumentCliTool {

    public DocumentXlsxRecalcTool(CliProcessRunner cliProcessRunner, SkillWorkspaceResolver workspaceResolver) {
        super(cliProcessRunner, workspaceResolver);
    }

    @Override
    public String toolKey() {
        return "document.xlsx.recalc";
    }

    @Override
    public String description() {
        return "重新计算 Excel 工作簿公式";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
                "type", "object",
                "required", List.of("inputPath"),
                "properties", Map.of(
                        "inputPath", Map.of("type", "string"),
                        "timeoutSeconds", Map.of("type", "integer")
                )
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String skillCode = resolveSkillCode(params);
        Path skillRoot = workspaceResolver.resolveSkillRoot(skillCode);
        Path input = workspaceResolver.resolveRelativePath(skillCode, requireString(params, "inputPath"));
        Long timeoutMs = null;
        if (params.get("timeoutSeconds") instanceof Number n) {
            timeoutMs = n.longValue() * 1000L;
        }
        List<String> argv = List.of(
                pythonCommand(),
                skillRoot.resolve("scripts/recalc.py").toString(),
                input.toString()
        );
        return runCli(params, argv, skillRoot, timeoutMs);
    }

    @Override
    protected String defaultSkillCode() {
        return "xlsx";
    }

    private String pythonCommand() {
        return System.getProperty("os.name", "").toLowerCase().contains("win") ? "python" : "python3";
    }
}
