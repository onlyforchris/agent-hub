package com.efloow.agenthub.system.config;

import com.efloow.agenthub.application.embedding.EmbeddingProvider;
import com.efloow.agenthub.infrastructure.embedding.ApiEmbeddingProvider;
import com.efloow.agenthub.infrastructure.embedding.KeywordEmbeddingProvider;
import com.efloow.agenthub.infrastructure.embedding.MockEmbeddingProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Text2SqlConfig {

    private static final Logger log = LoggerFactory.getLogger(Text2SqlConfig.class);

    @Value("${text2sql.embedding.provider:keyword}")
    private String providerType;

    @Value("${text2sql.embedding.base-url:}")
    private String baseUrl;

    @Value("${text2sql.embedding.api-key:}")
    private String apiKey;

    @Value("${text2sql.embedding.model:text-embedding-3-small}")
    private String model;

    @Value("${text2sql.embedding.dimensions:1024}")
    private int dimensions;

    @Bean
    public EmbeddingProvider embeddingProvider(ObjectMapper objectMapper) {
        return switch (providerType.toLowerCase()) {
            case "api" -> {
                if (baseUrl.isBlank() || apiKey.isBlank()) {
                    log.warn("text2sql embedding: api provider selected but url/key missing, falling back to keyword");
                    yield new KeywordEmbeddingProvider();
                }
                log.info("text2sql embedding: ApiEmbeddingProvider baseUrl={}, model={}", baseUrl, model);
                yield new ApiEmbeddingProvider(baseUrl, apiKey, model, dimensions, objectMapper);
            }
            case "keyword" -> {
                log.info("text2sql embedding: KeywordEmbeddingProvider (bag-of-words, zero-dependency)");
                yield new KeywordEmbeddingProvider();
            }
            default -> {
                log.warn("text2sql embedding: MockEmbeddingProvider (random vectors, for testing only)");
                yield new MockEmbeddingProvider();
            }
        };
    }
}
