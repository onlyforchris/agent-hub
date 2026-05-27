package com.efloow.agenthub.agent.cashflow;

import com.efloow.agenthub.base.ReActAgentBase;
import com.efloow.agenthub.domain.agent.*;
import com.efloow.agenthub.domain.agent.AgentInfo.SkillInfo;
import com.efloow.agenthub.domain.agent.AgentResult.ClientAction;
import com.efloow.agenthub.domain.agent.ConfirmRequest.RiskLevel;
import com.efloow.agenthub.domain.tool.ToolResult;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class CashflowAgent extends ReActAgentBase {

    private static final AgentInfo INFO = AgentInfo.builder()
        .id("cashflow")
        .name("现金流预测")
        .description("基于TMS资金流水数据，生成13周滚动现金流预测报告")
        .permissionLevel(1)
        .skills(List.of(
            new SkillInfo("forecast", "13周滚动预测", "基于TMS分类账数据生成滚动现金流预测"),
            new SkillInfo("explain", "预测结果解释", "AI解释关键变动和风险"),
            new SkillInfo("export", "导出Excel报表", "生成标准化预测报表")
        ))
        .toolIds(List.of("ledger.fetch"))
        .build();

    private final ForecastEngine forecastEngine = new ForecastEngine();
    private final CashflowValidator validator = new CashflowValidator();

    @Override
    public AgentInfo info() {
        return INFO;
    }

    @Override
    public String routeHint() {
        return "现金流预测、资金头寸查询、现金流分析、预测报表导出";
    }

    @Override
    public String systemPromptBase() {
        return """
            你是现金流预测分析师，服务于企业财务人员。你拥有以下核心能力：

            1. **获取资金数据** — 从TMS系统获取分类账流水数据
            2. **执行现金流预测** — 基于历史数据运行13周滚动预测模型
            3. **分析风险** — 识别资金缺口、异常波动
            4. **导出报表** — 生成Excel格式的预测报表

            ## 领域知识
            - 现金流预测基于移动平均+周期性因子算法
            - 正常情况下置信度在 70%-90% 之间
            - 资金缺口（负余额）需要关注，建议提前安排短期融资
            - 所有预测结果基于TMS实际流水数据，不要凭空编造数字

            ## 回答规范
            - 使用中文，简洁专业
            - 引用具体数据（周次、金额）
            - 如有资金缺口，明确标注并给出可操作建议
            - FINAL_ANSWER 使用 Markdown 格式
            """;
    }

    @Override
    public List<ToolDef> availableTools() {
        return List.of(
            new ToolDef("ledger.fetch", "从TMS获取资金流水数据（分类账）",
                RiskLevel.LOW,
                Map.of("companyId", "string: 公司ID，默认 demo-company")),
            new ToolDef("forecast.compute", "执行13周滚动现金流预测计算。需要先获取ledger数据。",
                RiskLevel.MEDIUM,
                Map.of("initialBalance", "number: 期初余额，默认为0")),
            new ToolDef("forecast.export", "导出当前预测结果到Excel报表文件",
                RiskLevel.MEDIUM,
                Map.of("format", "string: 导出格式，固定为 excel"))
        );
    }

    @Override
    protected ToolResult executeTool(String toolKey, Map<String, Object> params) {
        return switch (toolKey) {
            case "ledger.fetch" -> {
                ToolResult result = callTool(toolKey, params);
                if (result.success() && result.data() != null) {
                    executionState.put("ledgerData", result.data());
                    executionState.put("sessionId", params.getOrDefault("sessionId", ""));
                }
                yield result;
            }
            case "forecast.compute" -> doForecastCompute(params);
            case "forecast.export" -> doForecastExport(params);
            default -> super.executeTool(toolKey, params);
        };
    }

    // ── Domain: forecast compute ──

    private ToolResult doForecastCompute(Map<String, Object> params) {
        // Retrieve ledger data from shared execution state (populated by previous ledger.fetch call)
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rawData = (List<Map<String, Object>>) executionState.get("ledgerData");

        if (rawData == null || rawData.isEmpty()) {
            return ToolResult.fail("C001_NO_LEDGER_DATA", "缺少资金流水数据，请先执行 ledger.fetch 获取数据");
        }

        List<ForecastEngine.LedgerEntry> entries = rawData.stream()
            .map(row -> new ForecastEngine.LedgerEntry(
                ((Number) row.get("week")).intValue(),
                toBigDecimal(row.get("inflow")),
                toBigDecimal(row.get("outflow"))
            ))
            .toList();

        CashflowValidator.ValidationResult validation = validator.validate(entries);
        if (!validation.valid()) {
            return ToolResult.fail(validation.errorCode(), "数据校验失败：" + validation.message());
        }

        BigDecimal initialBalance = toBigDecimal(
            params.getOrDefault("initialBalance", BigDecimal.ZERO));
        ForecastEngine.ForecastConfig config = ForecastEngine.ForecastConfig.defaultConfig(initialBalance);
        ForecastEngine.ForecastResult forecastResult = forecastEngine.forecast(entries, config);

        // Build result map for LLM observation
        Map<String, Object> resultData = new LinkedHashMap<>();
        resultData.put("weeks", forecastResult.weeks().size());
        resultData.put("averageWeeklyNet", forecastResult.averageWeeklyNet().toString());
        resultData.put("finalBalance", forecastResult.weeks().get(forecastResult.weeks().size() - 1).balance().toString());
        resultData.put("gapWeeks", forecastResult.gapWeeks().stream()
            .map(w -> Map.of("week", w.week(), "balance", w.balance().toString()))
            .toList());
        resultData.put("confidence", forecastResult.confidence());

        // Store for later use (export, briefing)
        executionState.put("forecastResult", forecastResult);

        return ToolResult.ok(resultData);
    }

    // ── Domain: forecast export ──

    private ToolResult doForecastExport(Map<String, Object> params) {
        ForecastEngine.ForecastResult forecastResult =
            (ForecastEngine.ForecastResult) executionState.get("forecastResult");

        if (forecastResult == null) {
            return ToolResult.fail("C002_NO_FORECAST", "缺少预测结果，请先执行 forecast.compute");
        }

        String sessionId = (String) executionState.get("sessionId");
        String downloadUrl = "/api/agent/cashflow/export?sessionId=" + (sessionId != null ? sessionId : "");

        return ToolResult.ok(Map.of(
            "downloadUrl", downloadUrl,
            "message", "Excel报表已生成，请点击下载"
        ));
    }

    // ── Helpers ──

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal bd) return bd;
        return new BigDecimal(value.toString());
    }
}
