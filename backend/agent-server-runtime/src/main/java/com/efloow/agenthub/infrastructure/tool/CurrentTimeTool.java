package com.efloow.agenthub.infrastructure.tool;

import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class CurrentTimeTool implements ToolHandler {

    @Override
    public String toolKey() {
        return "system.time.now";
    }

    @Override
    public String description() {
        return "查询服务器当前日期、星期和时间";
    }

    @Override
    public String permission() {
        return "LEVEL_1";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of("timezone", Map.of("type", "string", "default", "Asia/Shanghai")),
            "required", List.of()
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String timezone = stringParam(params, "timezone", "Asia/Shanghai");
        ZoneId zone;
        try {
            zone = ZoneId.of(timezone);
        } catch (Exception e) {
            return ToolResult.fail("TIME001_INVALID_TIMEZONE", "不支持的时区: " + timezone);
        }

        Instant now = Instant.now();
        LocalDateTime localNow = LocalDateTime.ofInstant(now, zone);

        return ToolResult.ok(Map.of(
            "timezone", timezone,
            "date", localNow.toLocalDate().toString(),
            "time", localNow.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm:ss")),
            "weekday", chineseWeekday(localNow.getDayOfWeek()),
            "iso", now.toString()
        ));
    }

    private String stringParam(Map<String, Object> params, String key, String defaultValue) {
        Object value = params != null ? params.get(key) : null;
        return value == null || value.toString().isBlank() ? defaultValue : value.toString().trim();
    }

    private String chineseWeekday(DayOfWeek day) {
        return switch (day) {
            case MONDAY -> "星期一";
            case TUESDAY -> "星期二";
            case WEDNESDAY -> "星期三";
            case THURSDAY -> "星期四";
            case FRIDAY -> "星期五";
            case SATURDAY -> "星期六";
            case SUNDAY -> "星期日";
        };
    }
}
