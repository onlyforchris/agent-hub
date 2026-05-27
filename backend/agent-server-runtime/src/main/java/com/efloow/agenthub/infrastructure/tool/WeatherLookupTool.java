package com.efloow.agenthub.infrastructure.tool;

import com.efloow.agenthub.domain.tool.ToolHandler;
import com.efloow.agenthub.domain.tool.ToolResult;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class WeatherLookupTool implements ToolHandler {

    private static final Map<String, WeatherSnapshot> MOCK_WEATHER = Map.of(
        "上海", new WeatherSnapshot("上海", "多云", 24, 30, 68, "东南风 3 级", "适合通勤，午后体感略闷"),
        "北京", new WeatherSnapshot("北京", "晴", 18, 29, 36, "西南风 2 级", "昼夜温差偏大，注意补水"),
        "深圳", new WeatherSnapshot("深圳", "阵雨", 25, 31, 82, "南风 3 级", "建议携带雨具"),
        "广州", new WeatherSnapshot("广州", "雷阵雨", 24, 32, 86, "南风 2 级", "短时降雨概率较高"),
        "杭州", new WeatherSnapshot("杭州", "小雨", 21, 27, 78, "东北风 2 级", "路面湿滑，出行留足时间")
    );

    @Override
    public String toolKey() {
        return "weather.lookup";
    }

    @Override
    public String description() {
        return "查询指定城市的天气概况，当前使用内置示例数据";
    }

    @Override
    public String permission() {
        return "LEVEL_1";
    }

    @Override
    public Map<String, Object> inputSchema() {
        return Map.of(
            "type", "object",
            "properties", Map.of(
                "location", Map.of("type", "string", "description", "城市或地点，例如 上海、北京、深圳"),
                "date", Map.of("type", "string", "description", "查询日期，支持 yyyy-MM-dd、today、tomorrow、今天、明天")
            ),
            "required", List.of("location", "date")
        );
    }

    @Override
    public ToolResult invoke(Map<String, Object> params) {
        String location = requiredString(params, "location");
        if (location.isBlank()) {
            return ToolResult.fail("WEATHER001_LOCATION_REQUIRED", "查询天气需要提供地点");
        }

        String dateInput = requiredString(params, "date");
        if (dateInput.isBlank()) {
            return ToolResult.fail("WEATHER002_DATE_REQUIRED", "查询天气需要提供日期");
        }

        LocalDate date = resolveDate(dateInput);
        if (date == null) {
            return ToolResult.fail("WEATHER003_INVALID_DATE", "不支持的日期格式，请使用 yyyy-MM-dd、今天或明天");
        }

        WeatherSnapshot snapshot = MOCK_WEATHER.get(normalizeLocation(location));
        if (snapshot == null) {
            snapshot = new WeatherSnapshot(location, "多云", 20, 28, 60, "微风", "该城市暂无实时接入，返回通用示例天气");
        }

        return ToolResult.ok(Map.of(
            "location", snapshot.location(),
            "date", date.toString(),
            "condition", snapshot.condition(),
            "temperatureRange", snapshot.lowCelsius() + "-" + snapshot.highCelsius() + "℃",
            "humidity", snapshot.humidity() + "%",
            "wind", snapshot.wind(),
            "advice", snapshot.advice(),
            "source", "mock"
        ));
    }

    private String requiredString(Map<String, Object> params, String key) {
        Object value = params != null ? params.get(key) : null;
        return value == null ? "" : value.toString().trim();
    }

    private LocalDate resolveDate(String input) {
        String normalized = input.trim().toLowerCase(Locale.ROOT);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
        if ("today".equals(normalized) || "今天".equals(normalized)) {
            return today;
        }
        if ("tomorrow".equals(normalized) || "明天".equals(normalized)) {
            return today.plusDays(1);
        }
        try {
            return LocalDate.parse(normalized);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String normalizeLocation(String location) {
        return location.replace("市", "").trim().toLowerCase(Locale.ROOT);
    }

    private record WeatherSnapshot(
        String location,
        String condition,
        int lowCelsius,
        int highCelsius,
        int humidity,
        String wind,
        String advice
    ) {}
}
