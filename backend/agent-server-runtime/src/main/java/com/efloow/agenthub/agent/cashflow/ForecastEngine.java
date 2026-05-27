package com.efloow.agenthub.agent.cashflow;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

public class ForecastEngine {

    public static class LedgerEntry {
        private final int week;
        private final BigDecimal inflow;
        private final BigDecimal outflow;

        public LedgerEntry(int week, BigDecimal inflow, BigDecimal outflow) {
            this.week = week;
            this.inflow = inflow;
            this.outflow = outflow;
        }

        public int week() { return week; }
        public BigDecimal inflow() { return inflow; }
        public BigDecimal outflow() { return outflow; }
        public BigDecimal net() { return inflow.subtract(outflow); }
    }

    public static class ForecastConfig {
        private final int historyWeeks;
        private final int forecastWeeks;
        private final BigDecimal initialBalance;

        public ForecastConfig(int historyWeeks, int forecastWeeks, BigDecimal initialBalance) {
            this.historyWeeks = historyWeeks;
            this.forecastWeeks = forecastWeeks;
            this.initialBalance = initialBalance;
        }

        public static ForecastConfig defaultConfig(BigDecimal initialBalance) {
            return new ForecastConfig(12, 13, initialBalance);
        }

        public int historyWeeks() { return historyWeeks; }
        public int forecastWeeks() { return forecastWeeks; }
        public BigDecimal initialBalance() { return initialBalance; }
    }

    public static class WeekForecast {
        private final int week;
        private final BigDecimal inflow;
        private final BigDecimal outflow;
        private final BigDecimal net;
        private final BigDecimal balance;
        private final boolean isGap;

        public WeekForecast(int week, BigDecimal inflow, BigDecimal outflow, BigDecimal balance) {
            this.week = week;
            this.inflow = inflow;
            this.outflow = outflow;
            this.net = inflow.subtract(outflow);
            this.balance = balance;
            this.isGap = balance.compareTo(BigDecimal.ZERO) < 0;
        }

        public int week() { return week; }
        public BigDecimal inflow() { return inflow; }
        public BigDecimal outflow() { return outflow; }
        public BigDecimal net() { return net; }
        public BigDecimal balance() { return balance; }
        public boolean isGap() { return isGap; }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("week", week);
            map.put("inflow", inflow);
            map.put("outflow", outflow);
            map.put("net", net);
            map.put("balance", balance);
            map.put("isGap", isGap);
            return map;
        }
    }

    public static class ForecastResult {
        private final List<WeekForecast> weeks;
        private final BigDecimal averageWeeklyNet;
        private final String confidence;

        public ForecastResult(List<WeekForecast> weeks, BigDecimal averageWeeklyNet, String confidence) {
            this.weeks = weeks;
            this.averageWeeklyNet = averageWeeklyNet;
            this.confidence = confidence;
        }

        public List<WeekForecast> weeks() { return weeks; }
        public BigDecimal averageWeeklyNet() { return averageWeeklyNet; }
        public String confidence() { return confidence; }

        public WeekForecast lowestBalanceWeek() {
            return weeks.stream().min(Comparator.comparing(WeekForecast::balance)).orElse(null);
        }

        public List<WeekForecast> gapWeeks() {
            return weeks.stream().filter(WeekForecast::isGap).toList();
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("weeks", weeks.stream().map(WeekForecast::toMap).toList());
            map.put("averageWeeklyNet", averageWeeklyNet);
            map.put("confidence", confidence);
            WeekForecast lowest = lowestBalanceWeek();
            if (lowest != null) {
                map.put("lowestBalanceWeek", lowest.week());
                map.put("lowestBalance", lowest.balance());
            }
            map.put("gapWeeks", gapWeeks().stream().map(WeekForecast::week).toList());
            return map;
        }
    }

    /**
     * Execute 13-week rolling cashflow forecast.
     * Algorithm: moving average + cyclic factor (simple, explainable).
     */
    public ForecastResult forecast(List<LedgerEntry> entries, ForecastConfig config) {
        if (entries == null || entries.isEmpty()) {
            throw new IllegalArgumentException("Ledger data must not be empty");
        }

        // 1. Compute historical weekly net averages
        BigDecimal avgNet = entries.stream()
            .map(LedgerEntry::net)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(entries.size()), 2, RoundingMode.HALF_UP);

        // 2. Detect cyclic patterns (compare each week's net to average)
        Map<Integer, BigDecimal> cyclicFactors = detectCycles(entries, avgNet);

        // 3. Generate forecast
        int startWeek = entries.get(entries.size() - 1).week() + 1;
        BigDecimal balance = config.initialBalance();
        List<WeekForecast> forecastWeeks = new ArrayList<>();

        for (int i = 0; i < config.forecastWeeks(); i++) {
            int weekNum = startWeek + i;
            BigDecimal factor = cyclicFactors.getOrDefault(i % entries.size(), BigDecimal.ONE);
            BigDecimal forecastNet = avgNet.multiply(factor).setScale(2, RoundingMode.HALF_UP);

            // Distribute net into inflow and outflow based on historical ratios
            BigDecimal totalInflow = entries.stream().map(LedgerEntry::inflow)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalOutflow = entries.stream().map(LedgerEntry::outflow)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalAbsolute = totalInflow.add(totalOutflow);

            BigDecimal inflowPct = totalAbsolute.compareTo(BigDecimal.ZERO) > 0
                ? totalInflow.divide(totalAbsolute, 4, RoundingMode.HALF_UP)
                : BigDecimal.valueOf(0.5);

            BigDecimal forecastInflow, forecastOutflow;
            if (forecastNet.compareTo(BigDecimal.ZERO) >= 0) {
                // Net positive: inflow > outflow
                forecastOutflow = BigDecimal.valueOf(Math.abs(forecastNet.doubleValue() * (1 - inflowPct.doubleValue())))
                    .setScale(2, RoundingMode.HALF_UP);
                forecastInflow = forecastOutflow.add(forecastNet);
            } else {
                // Net negative: outflow > inflow
                forecastInflow = BigDecimal.valueOf(Math.abs(forecastNet.doubleValue() * inflowPct.doubleValue()))
                    .setScale(2, RoundingMode.HALF_UP);
                forecastOutflow = forecastInflow.subtract(forecastNet);
            }

            balance = balance.add(forecastNet);
            forecastWeeks.add(new WeekForecast(weekNum, forecastInflow, forecastOutflow, balance));
        }

        // 4. Compute confidence
        String confidence = computeConfidence(entries, avgNet, forecastWeeks);

        return new ForecastResult(forecastWeeks, avgNet, confidence);
    }

    private Map<Integer, BigDecimal> detectCycles(List<LedgerEntry> entries, BigDecimal avgNet) {
        Map<Integer, BigDecimal> factors = new LinkedHashMap<>();
        if (avgNet.compareTo(BigDecimal.ZERO) == 0) {
            for (int i = 0; i < entries.size(); i++) {
                factors.put(i, BigDecimal.ONE);
            }
            return factors;
        }

        for (int i = 0; i < entries.size(); i++) {
            LedgerEntry entry = entries.get(i);
            BigDecimal factor = entry.net().divide(avgNet, 4, RoundingMode.HALF_UP);
            // Clamp factor to reasonable range [0.3, 3.0]
            factor = factor.max(BigDecimal.valueOf(0.3)).min(BigDecimal.valueOf(3.0));
            factors.put(i, factor);
        }
        return factors;
    }

    private String computeConfidence(List<LedgerEntry> entries, BigDecimal avgNet,
                                      List<WeekForecast> forecast) {
        // Simple heuristic: lower variance = higher confidence
        if (entries.size() < 4) return "低";

        double variance = entries.stream()
            .mapToDouble(e -> e.net().subtract(avgNet).doubleValue())
            .map(v -> v * v)
            .average()
            .orElse(0);

        double cv = Math.sqrt(variance) / Math.abs(avgNet.doubleValue());
        if (cv < 0.3) return "高";
        if (cv < 0.7) return "中";
        return "低";
    }
}
