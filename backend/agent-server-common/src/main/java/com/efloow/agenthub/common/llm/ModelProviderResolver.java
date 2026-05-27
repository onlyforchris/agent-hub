package com.efloow.agenthub.common.llm;

import java.util.List;

/**
 * Resolves model provider configuration at runtime.
 * Implemented in agent-server-system (reads from sys_model_provider table).
 * Consumed by agent-server-runtime (LlmGatewayManager).
 */
public interface ModelProviderResolver {

    ModelProviderConfig resolve(String providerCode);

    record ModelProviderConfig(
        String providerCode,
        String providerName,
        String baseUrl,
        String apiKey,       // plaintext (decrypted)
        List<String> models,
        String defaultModel,
        boolean enabled
    ) {}
}
