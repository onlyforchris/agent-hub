package com.efloow.agenthub.infrastructure.skill;

import com.efloow.agenthub.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

@Component
public class SkillMdParser {

    private static final Pattern FRONTMATTER = Pattern.compile("^---\\s*\\n(.*?)\\n---\\s*\\n(.*)", Pattern.DOTALL);

    private final ObjectMapper objectMapper;
    private final Yaml yaml = new Yaml();

    public SkillMdParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ParsedSkillMd parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "SKILL.md 内容为空");
        }
        String normalized = raw.replace("\r\n", "\n");
        Matcher matcher = FRONTMATTER.matcher(normalized);
        if (!matcher.matches()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "SKILL.md 缺少 YAML frontmatter");
        }
        String yamlBlock = matcher.group(1);
        String body = matcher.group(2).trim();

        @SuppressWarnings("unchecked")
        Map<String, Object> frontmatter = yaml.load(yamlBlock) instanceof Map<?, ?> map
            ? (Map<String, Object>) map
            : new LinkedHashMap<>();

        String name = stringVal(frontmatter.get("name"));
        String description = stringVal(frontmatter.get("description"));
        if (description == null || description.isBlank()) {
            description = firstParagraph(body);
        }

        List<String> paths = extractPaths(frontmatter.get("paths"));
        Map<String, Object> policy = extractPolicy(frontmatter);
        Boolean disableAuto = boolFromFrontmatter(frontmatter.get("disable-model-invocation"));
        String context = stringVal(frontmatter.get("context"));

        if (name == null || name.isBlank()) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "frontmatter.name 不能为空");
        }

        return new ParsedSkillMd(name, description, body, frontmatter, paths, policy, disableAuto, context);
    }

    public String frontmatterToJson(Map<String, Object> frontmatter) {
        try {
            return objectMapper.writeValueAsString(frontmatter);
        } catch (Exception e) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "frontmatter 序列化失败");
        }
    }

    public String pathsToJson(List<String> paths) {
        try {
            return objectMapper.writeValueAsString(paths);
        } catch (Exception e) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "paths 序列化失败");
        }
    }

    public String policyToJson(Map<String, Object> policy) {
        try {
            return objectMapper.writeValueAsString(policy);
        } catch (Exception e) {
            throw new BusinessException("S006_SKILL_PARSE_INVALID", "policy 序列化失败");
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractPolicy(Map<String, Object> frontmatter) {
        Object metadata = frontmatter.get("metadata");
        if (metadata instanceof Map<?, ?> metaMap) {
            Object ep = metaMap.get("execution_policy");
            if (ep instanceof Map<?, ?> policyMap) {
                return (Map<String, Object>) policyMap;
            }
        }
        try {
            return objectMapper.readValue(
                com.efloow.agenthub.system.service.SkillRegistryService.DEFAULT_POLICY_JSON.trim(),
                new TypeReference<Map<String, Object>>() {}
            );
        } catch (Exception e) {
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> extractPaths(Object pathsObj) {
        if (pathsObj == null) {
            return List.of();
        }
        if (pathsObj instanceof List<?> list) {
            return list.stream().map(String::valueOf).toList();
        }
        if (pathsObj instanceof String s && !s.isBlank()) {
            return List.of(s.split(","));
        }
        return List.of();
    }

    private String stringVal(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    private Boolean boolFromFrontmatter(Object value) {
        if (value instanceof Boolean b) {
            return b;
        }
        if (value == null) {
            return null;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private String firstParagraph(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        String[] parts = body.split("\n\n", 2);
        return parts[0].replaceAll("^#+\\s*", "").trim();
    }

    public record ParsedSkillMd(
        String name,
        String description,
        String body,
        Map<String, Object> frontmatter,
        List<String> paths,
        Map<String, Object> policy,
        Boolean disableModelInvocation,
        String context
    ) {
    }
}
