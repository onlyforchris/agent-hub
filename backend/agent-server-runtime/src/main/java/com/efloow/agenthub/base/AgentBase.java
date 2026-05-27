package com.efloow.agenthub.base;

import com.efloow.agenthub.application.audit.TraceService;
import com.efloow.agenthub.application.llm.LlmGateway;
import com.efloow.agenthub.application.tool.ToolExecutor;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.domain.agent.*;
import com.efloow.agenthub.domain.tool.ToolResult;
import com.efloow.agenthub.domain.trace.TraceRecord;
import com.efloow.agenthub.domain.trace.TraceStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public abstract class AgentBase {

    protected final Logger log = LoggerFactory.getLogger(getClass());

    @Autowired
    protected ToolExecutor toolExecutor;

    @Autowired
    protected LlmGateway llmGateway;

    @Autowired
    protected TraceService traceService;

    // —— Subclass must implement ——
    public abstract AgentInfo info();
    public abstract Intent classify(String input, SessionContext ctx);
    public abstract AgentResult doExecute(Intent intent, SessionContext ctx);

    // —— Subclass may override ——
    public String routeHint() { return info().description(); }
    public String preferredModel() { return null; } // use provider defaultModel from DB
    public List<String> toolIds() { return info().toolIds(); }

    // —— Platform skeleton (final, not overridable) ——
    public final AgentResult execute(Intent intent, SessionContext ctx) {
        String traceId = MDC.get("traceId");
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
            MDC.put("traceId", traceId);
        }
        MDC.put("agentId", info().id());

        LocalDateTime startTime = LocalDateTime.now();
        List<TraceStep> steps = new ArrayList<>();

        log.info("agent execute start: agentId={}, intent={}, userId={}, sessionId={}",
            info().id(), intent.action(), ctx.userId(), ctx.sessionId());

        ctx.emit(AgentStreamEvent.step("start", "开始处理请求",
            Map.of("agentId", info().id(), "agentName", info().name(), "intent", intent.action())));

        try {
            // Permission check
            if (ctx.permission() != null) {
                int userLevel = permissionRank(ctx.permission());
                int requiredLevel = info().permissionLevel();
                if (userLevel < requiredLevel) {
                    log.warn("agent permission denied: agentId={}, userLevel={}, requiredLevel={}",
                        info().id(), userLevel, requiredLevel);
                    throw new BusinessException("P001_PERMISSION_DENIED",
                        "Agent " + info().name() + " requires permission LEVEL_" + requiredLevel);
                }
            }

            AgentResult result = doExecute(intent, ctx);

            long durationMs = Duration.between(startTime, LocalDateTime.now()).toMillis();
            log.info("agent execute done: agentId={}, intent={}, durationMs={}",
                info().id(), intent.action(), durationMs);

            TraceRecord trace = new TraceRecord(
                traceId, ctx.userId(), ctx.sessionId(), info().id(),
                intent.action(), intent.params().toString(),
                startTime, LocalDateTime.now(), steps
            );

            if (traceService != null) {
                traceService.record(trace);
            }

            ctx.emit(AgentStreamEvent.complete(result));
            return result;
        } catch (Exception e) {
            long durationMs = Duration.between(startTime, LocalDateTime.now()).toMillis();
            log.error("agent execute failed: agentId={}, intent={}, durationMs={}, error={}",
                info().id(), intent.action(), durationMs, e.getMessage(), e);

            ctx.emit(AgentStreamEvent.error(e.getMessage()));

            TraceRecord trace = new TraceRecord(
                traceId, ctx.userId(), ctx.sessionId(), info().id(),
                intent.action(), "ERROR: " + e.getMessage(),
                startTime, LocalDateTime.now(), steps
            );
            if (traceService != null) {
                traceService.record(trace);
            }
            throw e;
        } finally {
            MDC.remove("agentId");
        }
    }

    // —— Protected methods for subclass use ——
    protected ToolResult callTool(String toolKey, Map<String, Object> params) {
        if (toolExecutor == null) {
            throw new IllegalStateException("ToolExecutor not injected");
        }
        long start = System.currentTimeMillis();
        log.info("tool call start: toolKey={}", toolKey);
        try {
            ToolResult result = toolExecutor.invoke(toolKey, params);
            long durationMs = System.currentTimeMillis() - start;
            log.info("tool call done: toolKey={}, success={}, durationMs={}",
                toolKey, result.success(), durationMs);
            return result;
        } catch (Exception e) {
            long durationMs = System.currentTimeMillis() - start;
            log.error("tool call failed: toolKey={}, durationMs={}", toolKey, durationMs, e);
            throw e;
        }
    }

    protected LlmGateway.LlmResult callLlm(String promptKey, Map<String, Object> vars) {
        return callLlm(preferredModel(), promptKey, vars);
    }

    protected LlmGateway.LlmResult callLlm(String model, String promptKey, Map<String, Object> vars) {
        if (llmGateway == null) {
            throw new IllegalStateException("LlmGateway not injected");
        }
        long start = System.currentTimeMillis();
        log.info("llm call start: model={}, promptKey={}", model, promptKey);
        try {
            String systemPrompt = promptKey;
            String userInput = vars != null ? vars.toString() : "";
            List<LlmGateway.Message> messages = List.of(
                LlmGateway.Message.system(systemPrompt),
                LlmGateway.Message.user(userInput)
            );
            LlmGateway.LlmResult result = llmGateway.chat("deepseek", model, messages, LlmGateway.LlmOptions.DEFAULT);
            long durationMs = System.currentTimeMillis() - start;
            log.info("llm call done: model={}, inputTokens={}, outputTokens={}, durationMs={}",
                model, result.inputTokens(), result.outputTokens(), durationMs);
            return result;
        } catch (Exception e) {
            long durationMs = System.currentTimeMillis() - start;
            log.error("llm call failed: model={}, promptKey={}, durationMs={}", model, promptKey, durationMs, e);
            throw e;
        }
    }

    protected void audit(String action, Map<String, Object> detail) {
        if (traceService != null) {
            traceService.recordAction(action, detail);
        }
    }

    private int permissionRank(String permission) {
        if (permission == null) return 0;
        try {
            return Integer.parseInt(permission.replace("LEVEL_", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
