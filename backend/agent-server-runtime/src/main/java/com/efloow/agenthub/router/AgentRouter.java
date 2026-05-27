package com.efloow.agenthub.router;

import com.efloow.agenthub.application.llm.LlmGateway;
import com.efloow.agenthub.base.AgentBase;
import com.efloow.agenthub.domain.agent.Intent;
import com.efloow.agenthub.domain.agent.SessionContext;
import com.efloow.agenthub.router.Gatekeeper.GateDecision;
import com.efloow.agenthub.router.Gatekeeper.GateType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AgentRouter {

    private static final Logger log = LoggerFactory.getLogger(AgentRouter.class);

    private final Gatekeeper gatekeeper;
    private final LlmGateway llmGateway;
    private final Map<String, AgentBase> agentMap;

    public AgentRouter(Gatekeeper gatekeeper, LlmGateway llmGateway, List<AgentBase> agents) {
        this.gatekeeper = gatekeeper;
        this.llmGateway = llmGateway;
        this.agentMap = agents.stream().collect(Collectors.toMap(a -> a.info().id(), a -> a));
    }

    public record RoutingResult(AgentBase agent, Intent intent, String reasoning, String reply) {}

    public RoutingResult route(String userInput, String specifiedAgentId, SessionContext ctx) {
        // 1. If agentId specified, go directly
        if (specifiedAgentId != null && !specifiedAgentId.isBlank()) {
            AgentBase agent = agentMap.get(specifiedAgentId);
            if (agent != null) {
                Intent intent = agent.classify(userInput, ctx);
                log.info("routing: mode=direct, agentId={}, intent={}", agent.info().id(), intent.action());
                return new RoutingResult(agent, intent, "direct", null);
            }
            log.warn("routing: mode=direct, agentId={} not found", specifiedAgentId);
        }

        // 2. Keyword pre-match: deterministic keywords skip Gatekeeper entirely
        String keywordAgentId = keywordMatch(userInput, ctx);
        if (keywordAgentId != null) {
            AgentBase agent = agentMap.get(keywordAgentId);
            Intent intent = agent.classify(userInput, ctx);
            log.info("routing: mode=keyword, agentId={}, intent={}", agent.info().id(), intent.action());
            return new RoutingResult(agent, intent, "keyword matched " + agent.info().id(), null);
        }

        // 3. Gatekeeper: chat vs task? (only for inputs without keyword match)
        GateDecision gate = gatekeeper.classify(userInput, agentMap);
        if (gate.type() == GateType.CHAT) {
            log.info("routing: mode=chat, reasoning={}", gate.reasoning());
            String reply = generateChatReply(userInput);
            return new RoutingResult(null, null, gate.reasoning(), reply);
        }

        // 4. LLM-based agent matching
        String matchedAgentId = matchAgentByLlm(userInput, ctx);
        AgentBase agent = agentMap.get(matchedAgentId);

        if (agent == null) {
            log.info("routing: mode=no_match, availableAgents={}", agentMap.keySet());
            String suggestReply = suggestAgents(userInput);
            return new RoutingResult(null, null, "no match", suggestReply);
        }

        Intent intent = agent.classify(userInput, ctx);
        log.info("routing: mode=llm, agentId={}, intent={}", agent.info().id(), intent.action());
        return new RoutingResult(agent, intent, "llm routed to " + agent.info().id(), null);
    }

    private String matchAgentByLlm(String userInput, SessionContext ctx) {
        if (agentMap.isEmpty()) return null;
        if (agentMap.size() == 1) {
            String id = agentMap.keySet().iterator().next();
            log.debug("routing: single agent match, agentId={}", id);
            return id;
        }

        String agentList = agentMap.values().stream()
            .map(a -> "- " + a.info().id() + ": " + a.routeHint())
            .collect(Collectors.joining("\n"));

        String prompt = "Match the user's request to one of these agents. Respond with ONLY the agent ID.\n\n"
            + agentList;

        try {
            String response = llmGateway.complete("deepseek", null, prompt, userInput);
            String trimmed = response != null ? response.trim().toLowerCase() : "";
            for (String id : agentMap.keySet()) {
                if (trimmed.contains(id.toLowerCase())) {
                    log.debug("routing: llm matched agentId={}, rawResponse={}", id, trimmed);
                    return id;
                }
            }
            log.warn("routing: llm response did not match any agent, rawResponse={}", trimmed);
            return null;
        } catch (Exception e) {
            log.error("routing: llm agent matching failed", e);
            return null;
        }
    }

    private String keywordMatch(String userInput, SessionContext ctx) {
        if (userInput == null || userInput.isBlank()) {
            return null;
        }
        String text = userInput.toLowerCase();
        String contextText = recentConversationText(ctx).toLowerCase();
        if (agentMap.containsKey("life-assistant")
            && (text.contains("天气")
                || text.contains("气温")
                || text.contains("下雨")
                || text.contains("星期")
                || text.contains("几点")
                || text.contains("日期")
                || text.contains("今天")
                || text.contains("明天")
                || text.contains("待办")
                || text.contains("提醒")
                || text.contains("日程")
                || text.contains("日历")
                || text.contains("todo")
                || (contextText.contains("天气") && looksLikeFollowUp(text))
                || (contextText.contains("待办") && looksLikeFollowUp(text))
                || (contextText.contains("提醒") && looksLikeFollowUp(text)))) {
            return "life-assistant";
        }
        if (agentMap.containsKey("cashflow")
            && (text.contains("现金流")
                || text.contains("资金")
                || text.contains("预测")
                || text.contains("tms")
                || text.contains("报表"))) {
            return "cashflow";
        }
        if (agentMap.containsKey("document")
            && (text.contains("docx")
                || text.contains("word")
                || text.contains("pdf")
                || text.contains("pptx")
                || text.contains("xlsx")
                || text.contains("excel")
                || text.contains("文档")
                || text.contains("表格")
                || text.contains("演示文稿"))) {
            return "document";
        }
        return null;
    }

    private boolean looksLikeFollowUp(String text) {
        return text.length() <= 30
            || text.contains("这个")
            || text.contains("那里")
            || text.contains("刚才")
            || text.contains("上面")
            || text.contains("继续");
    }

    private String recentConversationText(SessionContext ctx) {
        if (ctx == null || ctx.variables() == null) {
            return "";
        }
        Object rawTurns = ctx.variables().get("conversationTurns");
        if (!(rawTurns instanceof List<?> turns) || turns.isEmpty()) {
            return "";
        }
        return turns.stream()
            .skip(Math.max(0, turns.size() - 3))
            .map(Object::toString)
            .collect(Collectors.joining("\n"));
    }

    private String generateChatReply(String userInput) {
        try {
            return llmGateway.complete("deepseek", null,
                "You are a helpful AI assistant. Respond conversationally to the user in Chinese.",
                userInput);
        } catch (Exception e) {
            log.warn("routing: chat reply generation failed, using fallback");
            String names = agentMap.values().stream()
                .map(a -> a.info().name())
                .collect(Collectors.joining("、"));
            return "您好，请问有什么可以帮您的？您可以尝试：" + names + "等相关功能。";
        }
    }

    private String suggestAgents(String userInput) {
        if (agentMap.isEmpty()) {
            return "目前没有可用的处理模块。请联系管理员配置。";
        }
        String names = agentMap.values().stream()
            .map(a -> a.info().name())
            .collect(Collectors.joining("、"));
        return "您的问题我暂时无法确定由哪个模块处理，请问是关于【" + names + "】的吗？请选择一个模块或重新描述您的问题。";
    }

    public Map<String, AgentBase> agents() {
        return Map.copyOf(agentMap);
    }
}
