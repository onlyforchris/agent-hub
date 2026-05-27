package com.efloow.agenthub.agent.document;

import com.efloow.agenthub.base.ReActAgentBase;
import com.efloow.agenthub.domain.agent.AgentInfo;
import com.efloow.agenthub.domain.agent.AgentInfo.SkillInfo;
import com.efloow.agenthub.domain.agent.ConfirmRequest.RiskLevel;
import com.efloow.agenthub.domain.agent.ToolDef;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DocumentAgent extends ReActAgentBase {

    private static final AgentInfo INFO = AgentInfo.builder()
            .id("document")
            .name("文档处理")
            .description("处理 Word/PDF/PPT/Excel 文档的读取、编辑、转换与校验")
            .permissionLevel(2)
            .skills(List.of(
                    new SkillInfo("docx", "Word 文档", "创建、编辑与分析 .docx"),
                    new SkillInfo("pdf", "PDF 文档", "PDF 读写、合并与预览"),
                    new SkillInfo("pptx", "演示文稿", "创建与编辑 .pptx"),
                    new SkillInfo("xlsx", "Excel 表格", "表格编辑、公式与财务模型规范")
            ))
            .toolIds(List.of(
                    "document.office.unpack",
                    "document.office.pack",
                    "document.office.validate",
                    "document.xlsx.recalc",
                    "document.extract-text",
                    "document.pandoc.convert",
                    "document.pdf.to-images"
            ))
            .build();

    @Override
    public AgentInfo info() {
        return INFO;
    }

    @Override
    public String routeHint() {
        return "Word、docx、PDF、pptx、Excel、xlsx、文档、表格、演示文稿、合并 PDF、提取文本";
    }

    @Override
    public String preferredModel() {
        return "deepseek-v3";
    }

    @Override
    public String systemPromptBase() {
        return ""
                + "你是企业文档处理助手, 负责 docx/pdf/pptx/xlsx 相关任务.\n"
                + "\n"
                + "## 核心规则\n"
                + "- 高风险写操作与脚本执行前必须使用 CONFIRM_NEEDED.\n"
                + "- 禁止编造文档内容; 读取/提取必须调用 document.extract-text 或 unpack 后基于结果回答.\n"
                + "- Skill 正文中的 bash 示例须映射为平台 Tool Key, 格式: ACTION: toolKey | {json}\n"
                + "\n"
                + "## Tool 映射\n"
                + "- python scripts/office/unpack.py -> document.office.unpack\n"
                + "- python scripts/office/pack.py -> document.office.pack\n"
                + "- python scripts/office/validate.py -> document.office.validate\n"
                + "- python scripts/recalc.py -> document.xlsx.recalc\n"
                + "- extract-text -> document.extract-text\n"
                + "- pandoc -> document.pandoc.convert\n"
                + "- pdftoppm -> document.pdf.to-images\n"
                + "\n"
                + "## 路径约定\n"
                + "- 用户文件放在 workspace/input/, 输出写到 workspace/output/ 或 workspace/unpacked/\n";
    }

    @Override
    public List<ToolDef> availableTools() {
        return List.of(
                tool("document.office.unpack", "解压 Office 文档", RiskLevel.HIGH),
                tool("document.office.pack", "打包 Office 文档", RiskLevel.HIGH),
                tool("document.office.validate", "校验 Office 文档", RiskLevel.LOW),
                tool("document.xlsx.recalc", "重算 Excel 公式", RiskLevel.MEDIUM),
                tool("document.extract-text", "提取文档纯文本", RiskLevel.LOW),
                tool("document.pandoc.convert", "Pandoc 格式转换", RiskLevel.MEDIUM),
                tool("document.pdf.to-images", "PDF 转图片", RiskLevel.MEDIUM)
        );
    }

    private ToolDef tool(String key, String description, RiskLevel risk) {
        return new ToolDef(key, description, risk, Map.of("type", "object"));
    }
}
