package com.efloow.agenthub.agent.cashflow;

import java.util.List;

public class CashflowValidator {

    public record ValidationResult(boolean valid, String errorCode, String message) {
        public static ValidationResult ok() {
            return new ValidationResult(true, null, null);
        }

        public static ValidationResult fail(String code, String message) {
            return new ValidationResult(false, code, message);
        }
    }

    /**
     * Validate ledger data completeness and integrity.
     */
    public ValidationResult validate(List<ForecastEngine.LedgerEntry> entries) {
        if (entries == null || entries.isEmpty()) {
            return ValidationResult.fail("D001_EMPTY_LEDGER", "分类账数据为空，请确认 TMS 数据源是否正常。");
        }

        // Check required fields
        for (int i = 0; i < entries.size(); i++) {
            ForecastEngine.LedgerEntry entry = entries.get(i);
            if (entry.inflow() == null || entry.outflow() == null) {
                return ValidationResult.fail("D002_MISSING_FIELD",
                    "第 " + (i + 1) + " 行数据缺少流入或流出金额。");
            }
            if (entry.inflow().compareTo(java.math.BigDecimal.ZERO) < 0
                || entry.outflow().compareTo(java.math.BigDecimal.ZERO) < 0) {
                return ValidationResult.fail("D003_NEGATIVE_AMOUNT",
                    "第 " + (i + 1) + " 行数据包含负数金额，请检查数据来源。");
            }
        }

        // Check week continuity
        for (int i = 1; i < entries.size(); i++) {
            int prev = entries.get(i - 1).week();
            int curr = entries.get(i).week();
            if (curr != prev + 1) {
                return ValidationResult.fail("D004_WEEK_GAP",
                    "第 " + prev + " 周与第 " + curr + " 周之间存在数据缺口，周次必须连续。");
            }
        }

        // Check minimum data size
        if (entries.size() < 4) {
            return ValidationResult.fail("D005_INSUFFICIENT_DATA",
                "历史数据不足（最少需要 4 周），当前仅有 " + entries.size() + " 周数据。");
        }

        return ValidationResult.ok();
    }
}
