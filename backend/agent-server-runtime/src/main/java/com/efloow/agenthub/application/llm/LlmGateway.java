package com.efloow.agenthub.application.llm;

import java.util.List;
import java.util.Map;

public interface LlmGateway {

    /**
     * Multi-turn chat completion.
     */
    LlmResult chat(String provider, String model, List<Message> messages, LlmOptions options);

    /**
     * Single-turn completion optimized for routing/classification.
     */
    String complete(String provider, String model, String systemPrompt, String userInput);

    record Message(String role, String content) {
        public static Message system(String content) { return new Message("system", content); }
        public static Message user(String content) { return new Message("user", content); }
        public static Message assistant(String content) { return new Message("assistant", content); }
    }

    record LlmOptions(Double temperature, Integer maxTokens, Map<String, Object> extra) {

        public static final LlmOptions DEFAULT = new LlmOptions(0.7, 2048, Map.of());

        public static LlmOptions routing() {
            return new LlmOptions(0.1, 256, Map.of());
        }

        public static LlmOptions brief() {
            return new LlmOptions(0.5, 1024, Map.of());
        }
    }

    record LlmResult(String content, int inputTokens, int outputTokens, String model) {}
}
