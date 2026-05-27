package com.efloow.agenthub.infrastructure.llm;

import com.efloow.agenthub.application.llm.LlmGateway;
import com.efloow.agenthub.common.llm.ModelProviderResolver;
import com.efloow.agenthub.common.llm.ModelProviderResolver.ModelProviderConfig;
import com.efloow.agenthub.system.service.LlmAuditService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LlmGatewayManager implements LlmGateway {

    private static final Logger log = LoggerFactory.getLogger(LlmGatewayManager.class);

    private final ObjectProvider<ModelProviderResolver> resolverProvider;
    private final ObjectProvider<LlmAuditService> llmAuditServiceProvider;
    private final ObjectMapper objectMapper;
    private final Map<String, RestClient> clients = new ConcurrentHashMap<>();
    private final Map<String, ModelProviderConfig> configCache = new ConcurrentHashMap<>();

    public LlmGatewayManager(
            ObjectProvider<ModelProviderResolver> resolverProvider,
            ObjectProvider<LlmAuditService> llmAuditServiceProvider,
            ObjectMapper objectMapper
    ) {
        this.resolverProvider = resolverProvider;
        this.llmAuditServiceProvider = llmAuditServiceProvider;
        this.objectMapper = objectMapper;
    }

    @Override
    public LlmResult chat(String provider, String model, List<Message> messages, LlmOptions options) {
        ModelProviderConfig config = getConfig(provider);

        // Env var fallback: if DB apiKey is empty, try DEEPSEEK_API_KEY
        if (config != null && config.enabled() && config.apiKey().isBlank()) {
            String envKey = System.getenv("DEEPSEEK_API_KEY");
            if (envKey != null && !envKey.isBlank()) {
                config = new ModelProviderConfig(
                    config.providerCode(), config.providerName(),
                    config.baseUrl(), envKey, config.models(),
                    config.defaultModel(), config.enabled());
                log.info("llm using DEEPSEEK_API_KEY env var for provider={}", provider);
            }
        }

        if (config == null || !config.enabled() || config.apiKey().isBlank()) {
            log.debug("llm fallback to mock: provider={}, reason={}",
                provider, config == null ? "no config" : !config.enabled() ? "disabled" : "no api key");
            return mockChat(provider, model, messages, options);
        }

        String modelName = resolveModel(model, config);
        RestClient client = getClient(config);

        log.info("llm call: provider={}, model={}, messages={}", provider, modelName, messages.size());

        List<Map<String, String>> msgList = messages.stream()
            .map(m -> Map.of("role", m.role(), "content", m.content()))
            .toList();

        double temperature = options != null && options.temperature() != null ? options.temperature() : 0.7;
        int maxTokens = options != null && options.maxTokens() != null ? options.maxTokens() : 2048;

        Map<String, Object> body = Map.of(
            "model", modelName,
            "messages", msgList,
            "temperature", temperature,
            "max_tokens", maxTokens
        );

        int maxRetries = 3;
        Exception lastException = null;
        long overallStart = System.currentTimeMillis();

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            long start = System.currentTimeMillis();
            try {
                String responseJson = client.post()
                    .uri("/v1/chat/completions")
                    .body(body)
                    .retrieve()
                    .onStatus(status -> {
                        int code = status.value();
                        if (code == 429 || code >= 500) {
                            return true; // retriable
                        }
                        return false;
                    }, (req, resp) -> {
                        String errorBody = new String(resp.getBody().readAllBytes());
                        log.error("LLM API error (retriable): status={}, body={}", resp.getStatusCode(), errorBody);
                        throw new RetriableException("LLM API error: " + resp.getStatusCode() + " - " + errorBody);
                    })
                    .onStatus(status -> status.value() >= 400, (req, resp) -> {
                        String errorBody = new String(resp.getBody().readAllBytes());
                        log.error("LLM API error: status={}, body={}", resp.getStatusCode(), errorBody);
                        throw new RuntimeException("LLM API error: " + resp.getStatusCode() + " - " + errorBody);
                    })
                    .body(String.class);

                LlmResult result = parseChatResponse(responseJson, modelName);
                long durationMs = System.currentTimeMillis() - start;
                log.info("llm response: provider={}, model={}, inputTokens={}, outputTokens={}, durationMs={}",
                    provider, modelName, result.inputTokens(), result.outputTokens(), durationMs);
                recordAudit(provider, modelName, result, durationMs, true, null);
                return result;
            } catch (RetriableException e) {
                lastException = e;
                if (attempt < maxRetries) {
                    long delayMs = (long) Math.pow(2, attempt) * 1000L;
                    log.warn("llm retry {}/{}: provider={}, model={}, delayMs={}, error={}",
                        attempt + 1, maxRetries, provider, modelName, delayMs, e.getMessage());
                    try { Thread.sleep(delayMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                }
            } catch (Exception e) {
                long durationMs = System.currentTimeMillis() - start;
                if (isRetriable(e) && attempt < maxRetries) {
                    lastException = e;
                    long delayMs = (long) Math.pow(2, attempt) * 1000L;
                    log.warn("llm retry {}/{}: provider={}, model={}, delayMs={}, error={}",
                        attempt + 1, maxRetries, provider, modelName, delayMs, e.getMessage());
                    try { Thread.sleep(delayMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
                } else {
                    log.error("llm call failed: provider={}, model={}, durationMs={}", provider, modelName, durationMs, e);
                    recordAudit(provider, modelName, new LlmResult("", 0, 0, modelName), durationMs, false, e.getMessage());
                    throw new RuntimeException("LLM call failed: " + e.getMessage(), e);
                }
            }
        }

        long totalDurationMs = System.currentTimeMillis() - overallStart;
        log.error("llm call failed after {} retries: provider={}, model={}, totalDurationMs={}",
            maxRetries, provider, modelName, totalDurationMs, lastException);
        String err = lastException != null ? lastException.getMessage() : "unknown";
        recordAudit(provider, modelName, new LlmResult("", 0, 0, modelName), totalDurationMs, false, err);
        throw new RuntimeException("LLM call failed after " + maxRetries + " retries: " + err, lastException);
    }

    private void recordAudit(String provider, String model, LlmResult result, long durationMs, boolean success, String error) {
        LlmAuditService auditService = llmAuditServiceProvider.getIfAvailable();
        if (auditService == null) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messageCount", 0);
        auditService.recordLlmCall(
                provider,
                model,
                result.inputTokens(),
                result.outputTokens(),
                durationMs,
                success,
                error,
                payload
        );
    }

    @Override
    public String complete(String provider, String model, String systemPrompt, String userInput) {
        List<Message> messages = List.of(
            Message.system(systemPrompt),
            Message.user(userInput)
        );
        LlmResult result = chat(provider, model, messages, LlmOptions.routing());
        return result.content();
    }

    // ── Provider resolution ──

    private ModelProviderConfig getConfig(String providerCode) {
        return configCache.computeIfAbsent(providerCode, code -> {
            ModelProviderResolver resolver = resolverProvider.getIfAvailable();
            if (resolver == null) {
                log.warn("ModelProviderResolver not available (DB may not be initialized)");
                return null;
            }
            return resolver.resolve(code);
        });
    }

    private String resolveModel(String requestedModel, ModelProviderConfig config) {
        // 1. Agent explicitly requested a model → use it if available
        if (requestedModel != null && !requestedModel.isBlank()) {
            if (config.models().isEmpty() || config.models().contains(requestedModel)) {
                return requestedModel;
            }
            log.warn("model {} not in provider models {}, will try anyway", requestedModel, config.models());
            return requestedModel;
        }
        // 2. Provider has a default model configured
        if (config.defaultModel() != null && !config.defaultModel().isBlank()) {
            return config.defaultModel();
        }
        // 3. Fallback: first model in the list
        if (!config.models().isEmpty()) {
            return config.models().get(0);
        }
        return "deepseek-v4-flash";
    }

    private RestClient getClient(ModelProviderConfig config) {
        return clients.computeIfAbsent(config.providerCode(), code ->
            RestClient.builder()
                .baseUrl(config.baseUrl())
                .defaultHeader("Authorization", "Bearer " + config.apiKey())
                .defaultHeader("Content-Type", "application/json")
                .build()
        );
    }

    // ── Retry helpers ──

    private boolean isRetriable(Exception e) {
        String msg = e.getMessage();
        if (msg == null) return false;
        String lower = msg.toLowerCase();
        return lower.contains("connection reset")
            || lower.contains("connection timed out")
            || lower.contains("connect timed out")
            || lower.contains("read timed out")
            || lower.contains("broken pipe")
            || lower.contains("service unavailable")
            || lower.contains("too many requests")
            || lower.contains("i/o error");
    }

    private static class RetriableException extends RuntimeException {
        RetriableException(String message) {
            super(message);
        }
    }

    // ── Chat response parsing ──

    @SuppressWarnings("unchecked")
    private LlmResult parseChatResponse(String json, String model) {
        try {
            Map<String, Object> root = objectMapper.readValue(json, Map.class);
            List<Map<String, Object>> choices = (List<Map<String, Object>>) root.get("choices");
            if (choices == null || choices.isEmpty()) {
                log.warn("llm response has no choices: model={}", model);
                return new LlmResult("", 0, 0, model);
            }
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = message != null ? (String) message.get("content") : "";
            // DeepSeek V4 reasoning models may put the reply in reasoning_content instead of content
            if ((content == null || content.isBlank()) && message != null) {
                Object reasoning = message.get("reasoning_content");
                if (reasoning != null) {
                    content = reasoning.toString();
                    log.debug("llm fallback to reasoning_content: model={}, len={}", model, content.length());
                }
            }

            Map<String, Object> usage = (Map<String, Object>) root.get("usage");
            int inputTokens = usage != null ? ((Number) usage.getOrDefault("prompt_tokens", 0)).intValue() : 0;
            int outputTokens = usage != null ? ((Number) usage.getOrDefault("completion_tokens", 0)).intValue() : 0;

            if (content == null || content.isBlank()) {
                log.warn("llm response content is blank: model={}, messageKeys={}",
                    model, message != null ? message.keySet() : "null");
            }

            return new LlmResult(content != null ? content : "", inputTokens, outputTokens, model);
        } catch (Exception e) {
            log.error("parse chat response failed", e);
            return new LlmResult("", 0, 0, model);
        }
    }

    // ── Mock fallback ──

    private LlmResult mockChat(String provider, String model, List<Message> messages, LlmOptions options) {
        String reply = "当前为 Mock 模式，请在管理后台配置模型供应商 API Key。";
        return new LlmResult(reply, 0, reply.length() / 2, model != null ? model : "mock");
    }
}
