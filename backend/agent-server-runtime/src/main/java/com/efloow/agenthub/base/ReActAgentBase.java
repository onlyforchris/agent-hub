package com.efloow.agenthub.base;

import com.efloow.agenthub.application.llm.LlmGateway;
import com.efloow.agenthub.application.session.AgentSessionManager;
import com.efloow.agenthub.application.skill.SkillConfirmAuditService;
import com.efloow.agenthub.application.skill.SkillForkExecutor;
import com.efloow.agenthub.application.skill.SkillSessionHolder;
import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import com.efloow.agenthub.domain.agent.*;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public abstract class ReActAgentBase extends AgentBase {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /** Execution-scoped state shared across ReAct loop iterations, isolated per request thread. */
    protected final Map<String, Object> executionState = new ThreadLocalExecutionState();

    private static final Pattern THOUGHT_PATTERN = Pattern.compile(
        "THOUGHT\\s*[:：]\\s*(.+?)(?=\\n(?:ACTION|CONFIRM_NEEDED|FINAL_ANSWER)|$)",
        Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
    private static final Pattern ACTION_PATTERN = Pattern.compile(
        "ACTION\\s*[:：]\\s*(\\S+)\\s*\\|\\s*(\\{.+})", Pattern.CASE_INSENSITIVE);
    private static final Pattern CONFIRM_PATTERN = Pattern.compile(
        "CONFIRM_NEEDED\\s*[:：]\\s*(.+?)\\s*\\|\\s*(LOW|MEDIUM|HIGH|CRITICAL)\\s*\\|\\s*(\\{.+})",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern FINAL_ANSWER_PATTERN = Pattern.compile(
        "FINAL_ANSWER\\s*[:：]\\s*(.+)", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

    @Autowired
    private AgentSessionManager sessionManager;

    @Autowired(required = false)
    private SkillConfirmAuditService skillConfirmAuditService;

    @Autowired(required = false)
    private SkillSessionHolder skillSessionHolder;

    @Autowired(required = false)
    private SkillForkExecutor skillForkExecutor;

    // —— Subclass must implement ——

    /** Tools the LLM can choose from. */
    public abstract List<ToolDef> availableTools();

    /** System prompt that describes the agent's role and domain knowledge. */
    public abstract String systemPromptBase();

    // —— ReActAgentBase provides default classify ——

    @Override
    public Intent classify(String input, SessionContext ctx) {
        return new Intent("react", Map.of("input", input));
    }

    // —— Subclass may override ——

    public int maxIterations() { return 5; }

    public long confirmationTimeoutSeconds() { return 60; }

    /** Override to handle domain-specific tools that aren't registered as ToolHandler beans. */
    protected ToolResult executeTool(String toolKey, Map<String, Object> params) {
        return callTool(toolKey, params);
    }

    /** Skill fork 子 Agent 调用 Tool 的公开入口。 */
    public ToolResult executeToolPublic(String toolKey, Map<String, Object> params) {
        return executeTool(toolKey, params);
    }

    /** Skill fork 子 Agent 读取工具清单。 */
    public List<ToolDef> availableToolsPublic() {
        return availableTools();
    }

    @Override
    public final AgentResult doExecute(Intent intent, SessionContext ctx) {
        if (shouldFork(ctx) && skillForkExecutor != null) {
            SkillRuntimeView skill = resolveForkSkill(ctx);
            if (skill != null) {
                String userInput = intent.paramString("input");
                if (userInput == null) {
                    userInput = "";
                }
                return skillForkExecutor.executeFork(skill, userInput, ctx, this);
            }
        }

        try {
            String userInput = intent.paramString("input");
            if (userInput == null) userInput = "";

            executionState.clear();
            Object skillContent = ctx.get("skillContentMd");
            if (skillContent != null && !shouldFork(ctx)) {
                executionState.put("skillPromptAppendix", skillContent);
                executionState.put("skillCode", ctx.get("skillCode"));
            }

            String model = preferredModel();
            List<LlmGateway.Message> messages = new ArrayList<>();
            messages.add(LlmGateway.Message.system(buildFullSystemPrompt()));
            appendConversationHistory(messages, ctx);
            messages.add(LlmGateway.Message.user(userInput));

            Map<String, Object> resultData = new LinkedHashMap<>();
            String finalAnswer = null;

            for (int i = 0; i < maxIterations(); i++) {
                log.info("react loop iteration={}, agentId={}", i, info().id());

                ctx.emit(AgentStreamEvent.step("think", "正在分析第 " + (i + 1) + " 步...",
                    Map.of("iteration", i)));

                LlmGateway.LlmResult llmResult;
                try {
                    llmResult = llmGateway.chat("deepseek", model, messages, LlmGateway.LlmOptions.DEFAULT);
                } catch (Exception e) {
                    log.error("react llm call failed: iteration={}", i, e);
                    finalAnswer = "模型调用失败，请稍后重试。";
                    break;
                }

                String response = llmResult.content();
                log.info("react llm response: iteration={}, contentLen={}, preview={}",
                    i, response != null ? response.length() : 0,
                    response != null ? response.substring(0, Math.min(200, response.length())) : "null");

                // Retry once if LLM returned empty content
                if (response == null || response.isBlank()) {
                    log.warn("react llm returned blank content, retrying once: iteration={}", i);
                    try {
                        llmResult = llmGateway.chat("deepseek", model, messages, LlmGateway.LlmOptions.DEFAULT);
                        response = llmResult.content();
                        log.info("react llm retry response: contentLen={}",
                            response != null ? response.length() : 0);
                    } catch (Exception e) {
                        log.error("react llm retry also failed: iteration={}", i, e);
                    }
                }

                if (response == null || response.isBlank()) {
                    log.warn("react llm still blank after retry, forcing finalization: iteration={}", i);
                    finalAnswer = null;
                    break;
                }

                ReActParsed parsed = parseResponse(response);

                // Emit thought to frontend
                if (parsed.thought != null && !parsed.thought.isBlank()) {
                    ctx.emit(AgentStreamEvent.thought(parsed.thought));
                }

                // Check for final answer
                if (parsed.finalAnswer != null) {
                    finalAnswer = parsed.finalAnswer;
                    break;
                }

                // Check for confirmation needed
                if (parsed.confirmNeeded != null) {
                    boolean approved = requestConfirmation(parsed.confirmNeeded, ctx);
                    messages.add(LlmGateway.Message.assistant(response));
                    messages.add(LlmGateway.Message.user(approved
                        ? "用户已确认，请继续执行剩余步骤。"
                        : "用户取消了此操作，请跳过此步骤，调整计划继续执行或告知用户操作已被取消。"));
                    continue;
                }

                // Check for tool action
                if (parsed.actionTool != null) {
                    ctx.emit(AgentStreamEvent.step("action",
                        "执行工具: " + parsed.actionTool,
                        Map.of("tool", parsed.actionTool, "params", parsed.actionParams)));

                    ToolResult toolResult = executeTool(parsed.actionTool, parsed.actionParams);
                    executionState.put("lastToolResult", toolResult);
                    executionState.put("lastToolKey", parsed.actionTool);

                    String observation;
                    if (toolResult.success()) {
                        observation = "工具 [" + parsed.actionTool + "] 执行成功。结果: "
                            + (toolResult.data() != null ? toolResult.data().toString() : "无数据");
                        resultData.put(parsed.actionTool, toolResult.data());
                        // If the tool returned data, also store it under the tool key for domain tools
                        if (toolResult.data() != null) {
                            executionState.put(parsed.actionTool + ".result", toolResult.data());
                        }
                    } else {
                        observation = "工具 [" + parsed.actionTool + "] 执行失败: "
                            + toolResult.errorCode() + " - " + toolResult.errorMessage();
                    }

                    ctx.emit(AgentStreamEvent.step("observation", observation,
                        Map.of("tool", parsed.actionTool, "success", toolResult.success())));

                    messages.add(LlmGateway.Message.assistant(response));
                    messages.add(LlmGateway.Message.user("OBSERVATION: " + observation));
                    continue;
                }

                // No actionable content — treat as final answer
                finalAnswer = response;
                break;
            }

            if (finalAnswer == null) {
                // Force finalization: ask LLM to summarize based on what's been done so far
                ctx.emit(AgentStreamEvent.step("think", "正在生成最终回复...", Map.of()));
                messages.add(LlmGateway.Message.user(
                    "请基于以上所有工具执行结果，通过 FINAL_ANSWER 给用户一个完整的回复。不要继续调用工具。"));
                try {
                    LlmGateway.LlmResult finalResult = llmGateway.chat(
                        "deepseek", model, messages, LlmGateway.LlmOptions.DEFAULT);
                    ReActParsed finalParsed = parseResponse(finalResult.content());
                    finalAnswer = finalParsed.finalAnswer() != null
                        ? finalParsed.finalAnswer()
                        : finalResult.content();
                } catch (Exception e) {
                    log.error("react finalization failed", e);
                    finalAnswer = "抱歉，处理过程中遇到问题，请简化您的问题后重试。";
                }
            }

            return new AgentResult(finalAnswer, resultData, List.of(),
                info().id(), MDC.get("traceId"), null);
        } finally {
            executionState.clear();
        }
    }

    // —— Internal: build system prompt ——

    private String buildFullSystemPrompt() {
        StringBuilder sb = new StringBuilder();
        sb.append(systemPromptBase()).append("\n\n");

        Object skillAppendix = executionState.get("skillPromptAppendix");
        if (skillAppendix != null) {
            sb.append("## 已激活 Skill: ").append(executionState.get("skillCode")).append("\n");
            sb.append(skillAppendix).append("\n\n");
        }

        sb.append("## 可用工具\n");
        for (ToolDef tool : availableTools()) {
            sb.append(tool.toPromptFormat()).append("\n");
        }

        sb.append("""

            ## 输出格式（必须严格遵守，禁止输出其他内容）

            你有三种合法的响应方式：

            ### 方式一：执行工具
            THOUGHT: <简短分析：当前要做什么，为什么>
            ACTION: <toolKey> | <JSON参数>

            ### 方式二：请求确认（仅 HIGH/CRITICAL 时用）
            THOUGHT: <分析>
            CONFIRM_NEEDED: <操作描述> | <HIGH或CRITICAL> | <JSON详情>

            ### 方式三：结束任务
            THOUGHT: <总结>
            FINAL_ANSWER: <Markdown格式的最终回复>

            ## 示例对话（以天气查询为例，展示工具调用→最终回复的完整流程）

            用户: 今天上海天气怎么样

            你的回复:
            THOUGHT: 用户询问今天上海的天气，需要调用天气查询工具。
            ACTION: weather.lookup | {"location": "上海", "date": "today"}

            OBSERVATION: 工具 [weather.lookup] 执行成功。结果: {temperature: "25°C", condition: "多云转晴", humidity: "65%"}

            你的回复:
            THOUGHT: 已获取天气数据，直接告知用户即可。
            FINAL_ANSWER: 今天上海的天气：多云转晴，气温 25°C，湿度 65%，适合出行。

            ## 关键规则
            - 任务完成后必须输出 FINAL_ANSWER，不要重复调用工具
            - 如果工具返回错误，分析原因后输出 FINAL_ANSWER 告知用户
            - 不要在一次响应中同时包含 ACTION 和 FINAL_ANSWER
            - 不要编造数据，只引用工具返回的真实数据
            """);

        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private void appendConversationHistory(List<LlmGateway.Message> messages, SessionContext ctx) {
        // Inject session summary if available (compacted older turns)
        Object rawSummary = ctx.variables().get("sessionSummary");
        if (rawSummary instanceof String summary && !summary.isBlank()) {
            messages.add(LlmGateway.Message.system(
                "[会话摘要] 以下是本次会话中较早讨论的话题摘要：\n" + summary));
        }

        Object rawTurns = ctx.variables().get("conversationTurns");
        if (!(rawTurns instanceof List<?> turns) || turns.isEmpty()) {
            return;
        }
        messages.add(LlmGateway.Message.system("""
            以下是当前会话的最近上下文。用户没有点击新消息时，后续输入默认延续这个上下文。
            如果用户的本轮输入是不完整补充，例如只给地点、日期、金额或对象，请结合上一轮问题理解。
            """));
        for (Object rawTurn : turns) {
            if (!(rawTurn instanceof Map<?, ?> turn)) {
                continue;
            }
            Object userInput = turn.get("userInput");
            Object agentReply = turn.get("agentReply");
            if (userInput != null && !userInput.toString().isBlank()) {
                messages.add(LlmGateway.Message.user(userInput.toString()));
            }
            if (agentReply != null && !agentReply.toString().isBlank()) {
                messages.add(LlmGateway.Message.assistant(agentReply.toString()));
            }
        }
    }

    // —— Internal: parse LLM response ——

    private ReActParsed parseResponse(String response) {
        if (response == null || response.isBlank()) {
            log.warn("react llm response is blank, will retry");
            return new ReActParsed(null, null, null, null, null);
        }

        String thought = extractGroup(THOUGHT_PATTERN, response, 1);

        // Check FINAL_ANSWER
        String finalAnswer = extractGroup(FINAL_ANSWER_PATTERN, response, 1);
        if (finalAnswer != null && !finalAnswer.isBlank()) {
            return new ReActParsed(thought, null, null, null, finalAnswer.trim());
        }

        // Check CONFIRM_NEEDED
        Matcher confirmMatcher = CONFIRM_PATTERN.matcher(response);
        if (confirmMatcher.find()) {
            String desc = confirmMatcher.group(1).trim();
            ConfirmRequest.RiskLevel riskLevel;
            try {
                riskLevel = ConfirmRequest.RiskLevel.valueOf(confirmMatcher.group(2).trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                riskLevel = ConfirmRequest.RiskLevel.MEDIUM;
            }
            Map<String, Object> detail = parseJson(confirmMatcher.group(3).trim());
            String confirmId = UUID.randomUUID().toString();
            return new ReActParsed(thought, null, null,
                new ConfirmRequest(confirmId, null, desc, desc, riskLevel, detail), null);
        }

        // Check ACTION
        Matcher actionMatcher = ACTION_PATTERN.matcher(response);
        if (actionMatcher.find()) {
            String toolKey = actionMatcher.group(1).trim();
            Map<String, Object> params = parseJson(actionMatcher.group(2).trim());
            return new ReActParsed(thought, toolKey, params, null, null);
        }

        // No structured output found — return as-is
        return new ReActParsed(thought, null, null, null, null);
    }

    // —— Internal: confirmation ——

    private boolean requestConfirmation(ConfirmRequest req, SessionContext ctx) {
        String sessionId = ctx.sessionId();
        Map<String, Object> detail = req.detail() != null ? new LinkedHashMap<>(req.detail()) : new LinkedHashMap<>();
        if (ctx.get("skillCode") != null) {
            detail.put("skillCode", ctx.get("skillCode"));
            detail.put("skillVersion", ctx.get("skillVersion"));
            detail.put("actionType", "tool");
        }
        ConfirmRequest fullReq = new ConfirmRequest(
            req.confirmId(), sessionId, req.action(), req.description(),
            req.riskLevel(), detail);

        ctx.emit(AgentStreamEvent.confirmRequest(fullReq));

        if (skillConfirmAuditService != null && skillSessionHolder != null && skillSessionHolder.currentSkill() != null) {
            skillConfirmAuditService.registerPending(new SkillConfirmAuditService.PendingSkillConfirm(
                fullReq.confirmId(),
                "tool",
                fingerprint(fullReq),
                fullReq.riskLevel().name(),
                detail
            ));
        }

        if (sessionManager == null) {
            log.warn("AgentSessionManager not available, auto-approving");
            return true;
        }

        ConfirmResponse resp = sessionManager.waitForConfirmation(
            sessionId, fullReq.confirmId(), confirmationTimeoutSeconds());

        if (resp.approved()) {
            ctx.emit(AgentStreamEvent.confirmed(fullReq.confirmId()));
        } else {
            ctx.emit(AgentStreamEvent.cancelled(fullReq.confirmId()));
        }

        return resp.approved();
    }

    private String fingerprint(ConfirmRequest req) {
        return Integer.toHexString(Objects.hash(req.action(), req.description(), req.detail()));
    }

    // —— Internal: helpers ——

    private String extractGroup(Pattern pattern, String input, int group) {
        Matcher m = pattern.matcher(input);
        if (m.find()) {
            String val = m.group(group);
            return val != null ? val.trim() : null;
        }
        return null;
    }

    private boolean shouldFork(SessionContext ctx) {
        return "fork".equals(ctx.get("skillContextMode"));
    }

    private SkillRuntimeView resolveForkSkill(SessionContext ctx) {
        if (skillSessionHolder != null && skillSessionHolder.currentSkill() != null) {
            return skillSessionHolder.currentSkill();
        }
        Object code = ctx.get("skillCode");
        if (code == null) {
            return null;
        }
        return new SkillRuntimeView(
                null,
                String.valueOf(code),
                String.valueOf(ctx.get("skillName")),
                null,
                String.valueOf(ctx.get("skillVersion")),
                ctx.get("skillContentMd") != null ? String.valueOf(ctx.get("skillContentMd")) : null,
                List.of(),
                readPolicyMap(ctx.get("skillPolicy")),
                "fork",
                true,
                true,
                "medium"
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readPolicyMap(Object rawPolicy) {
        if (rawPolicy instanceof Map<?, ?> policyMap) {
            return (Map<String, Object>) policyMap;
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("failed to parse tool params json: {}", json, e);
            return Map.of("raw", json);
        }
    }

    private record ReActParsed(
        String thought,
        String actionTool,
        Map<String, Object> actionParams,
        ConfirmRequest confirmNeeded,
        String finalAnswer
    ) {}

    private static class ThreadLocalExecutionState extends AbstractMap<String, Object> {
        private final ThreadLocal<Map<String, Object>> delegate =
            ThreadLocal.withInitial(LinkedHashMap::new);

        @Override
        public Object put(String key, Object value) {
            return delegate.get().put(key, value);
        }

        @Override
        public Object get(Object key) {
            return delegate.get().get(key);
        }

        @Override
        public Object getOrDefault(Object key, Object defaultValue) {
            return delegate.get().getOrDefault(key, defaultValue);
        }

        @Override
        public void clear() {
            delegate.remove();
        }

        @Override
        public Set<Entry<String, Object>> entrySet() {
            return delegate.get().entrySet();
        }
    }
}
