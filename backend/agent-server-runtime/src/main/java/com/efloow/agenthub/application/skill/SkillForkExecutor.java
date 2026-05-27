package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.application.llm.LlmGateway;
import com.efloow.agenthub.base.AgentBase;
import com.efloow.agenthub.base.ReActAgentBase;
import com.efloow.agenthub.domain.agent.AgentResult;
import com.efloow.agenthub.domain.agent.AgentStreamEvent;
import com.efloow.agenthub.domain.agent.SessionContext;
import com.efloow.agenthub.domain.agent.ToolDef;
import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

/**
 * context=fork 时在隔离上下文中执行 Skill，不污染主 Agent 系统 Prompt。
 */
@Service
public class SkillForkExecutor {

    private static final Logger log = LoggerFactory.getLogger(SkillForkExecutor.class);

    private static final Pattern ACTION_PATTERN = Pattern.compile(
            "ACTION\\s*[:：]\\s*(\\S+)\\s*\\|\\s*(\\{.+})", Pattern.CASE_INSENSITIVE);
    private static final Pattern FINAL_ANSWER_PATTERN = Pattern.compile(
            "FINAL_ANSWER\\s*[:：]\\s*(.+)", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final LlmGateway llmGateway;

    public SkillForkExecutor(LlmGateway llmGateway) {
        this.llmGateway = llmGateway;
    }

    public AgentResult executeFork(
            SkillRuntimeView skill,
            String userInput,
            SessionContext ctx,
            AgentBase parentAgent
    ) {
        log.info("skill fork execute: skillCode={}, agentId={}", skill.skillCode(), parentAgent.info().id());
        ctx.emit(AgentStreamEvent.step("skill_fork", "Skill 隔离执行: " + skill.skillName(),
                Map.of("skillCode", skill.skillCode(), "contextMode", "fork")));

        String model = parentAgent.preferredModel();
        List<LlmGateway.Message> messages = new ArrayList<>();
        messages.add(LlmGateway.Message.system(buildForkSystemPrompt(skill, parentAgent)));
        messages.add(LlmGateway.Message.user(userInput));

        Map<String, Object> resultData = new LinkedHashMap<>();
        resultData.put("skillCode", skill.skillCode());
        resultData.put("contextMode", "fork");

        for (int i = 0; i < 3; i++) {
            LlmGateway.LlmResult llmResult = llmGateway.chat(
                    "deepseek", model, messages, LlmGateway.LlmOptions.DEFAULT);
            String response = llmResult.content();
            if (response == null || response.isBlank()) {
                break;
            }

            Matcher actionMatcher = ACTION_PATTERN.matcher(response);
            if (actionMatcher.find() && parentAgent instanceof ReActAgentBase reactAgent) {
                String toolKey = actionMatcher.group(1).trim();
                String paramsJson = actionMatcher.group(2).trim();
                Map<String, Object> params = parseJson(paramsJson);
                params.putIfAbsent("skillCode", skill.skillCode());
                ToolResult toolResult = reactAgent.executeToolPublic(toolKey, params);
                messages.add(LlmGateway.Message.assistant(response));
                messages.add(LlmGateway.Message.user("OBSERVATION: " + formatObservation(toolKey, toolResult)));
                resultData.put("forkTool_" + i, toolKey);
                continue;
            }

            Matcher finalMatcher = FINAL_ANSWER_PATTERN.matcher(response);
            String answer = finalMatcher.find() ? finalMatcher.group(1).trim() : response.trim();
            return new AgentResult(answer, resultData, List.of(),
                    parentAgent.info().id(), MDC.get("traceId"), null);
        }

        return new AgentResult(
                "Skill 隔离执行未能在限定步数内完成，请简化请求后重试。",
                resultData,
                List.of(),
                parentAgent.info().id(),
                MDC.get("traceId"),
                null
        );
    }

    private String buildForkSystemPrompt(SkillRuntimeView skill, AgentBase parentAgent) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是 Skill 隔离执行子 Agent。\n");
        sb.append("当前 Skill: ").append(skill.skillName()).append(" (").append(skill.skillCode()).append(")\n\n");
        if (skill.contentMd() != null) {
            sb.append(skill.contentMd()).append("\n\n");
        }
        if (parentAgent instanceof ReActAgentBase reactAgent) {
            sb.append("## 可用工具\n");
            for (ToolDef tool : reactAgent.availableToolsPublic()) {
                sb.append(tool.toPromptFormat()).append('\n');
            }
            sb.append("""
                
                ## 输出格式
                - 需要工具: ACTION: <toolKey> | <JSON>
                - 完成: FINAL_ANSWER: <Markdown>
                """);
        } else {
            sb.append("请基于 Skill 指令直接给出 FINAL_ANSWER。\n");
        }
        return sb.toString();
    }

    private Map<String, Object> parseJson(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private String formatObservation(String toolKey, ToolResult result) {
        if (result.success()) {
            return "工具 [" + toolKey + "] 成功: " + result.data();
        }
        return "工具 [" + toolKey + "] 失败: " + result.errorMessage();
    }
}
