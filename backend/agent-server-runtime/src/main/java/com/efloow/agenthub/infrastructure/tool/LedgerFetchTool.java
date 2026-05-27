package com.efloow.agenthub.infrastructure.tool;

import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import java.math.BigDecimal;
import java.util.*;

import org.springframework.stereotype.Component;

@Component
public class LedgerFetchTool implements ToolHandler {

    @Override
    public String toolKey() {
        return "ledger.fetch";
    }

    @Override
    public String description() {
        return "从 TMS 系统获取资金流水分类账数据";
    }

    @Override
    public String permission() {
        return "LEVEL_1";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of("type", "object", "required", List.of("companyId"));
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        // TODO: Replace with TMS database query when connected
        return ToolResult.ok(List.of(
            createRow(1,  "5200000", "3800000"),
            createRow(2,  "4100000", "4500000"),
            createRow(3,  "4800000", "3700000"),
            createRow(4,  "3600000", "5900000"),
            createRow(5,  "5100000", "4200000"),
            createRow(6,  "4300000", "4000000"),
            createRow(7,  "2800000", "5100000"),
            createRow(8,  "5500000", "3800000"),
            createRow(9,  "4800000", "4400000"),
            createRow(10, "3900000", "4500000"),
            createRow(11, "5200000", "3900000"),
            createRow(12, "6000000", "4100000")
        ));
    }

    private Map<String, Object> createRow(int week, String inflow, String outflow) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("week", week);
        row.put("inflow", new BigDecimal(inflow));
        row.put("outflow", new BigDecimal(outflow));
        return row;
    }
}
