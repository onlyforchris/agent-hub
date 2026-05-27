package com.efloow.agenthub.infrastructure.embedding;

import com.efloow.agenthub.application.embedding.EmbeddingProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * 基于 OpenAI 兼容 API 的 Embedding 实现。
 * 调用 POST /v1/embeddings，兼容 text-embedding-3-small 等模型。
 */
public class ApiEmbeddingProvider implements EmbeddingProvider {

    private static final Logger log = LoggerFactory.getLogger(ApiEmbeddingProvider.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final String model;
    private final int dimension;

    public ApiEmbeddingProvider(String baseUrl, String apiKey, String model, int dimension, ObjectMapper objectMapper) {
        this.webClient = WebClient.builder()
            .baseUrl(baseUrl)
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .build();
        this.objectMapper = objectMapper;
        this.model = model;
        this.dimension = dimension;
    }

    @Override
    public float[] embed(String text) {
        List<float[]> results = embedBatch(List.of(text));
        return results.isEmpty() ? new float[0] : results.get(0);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        if (texts.isEmpty()) {
            return List.of();
        }
        try {
            String body = objectMapper.writeValueAsString(Map.of(
                "model", model,
                "input", texts,
                "encoding_format", "float"
            ));
            String response = webClient.post()
                .uri("/v1/embeddings")
                .header("Content-Type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();
            JsonNode root = objectMapper.readTree(response);
            JsonNode data = root.get("data");
            List<float[]> results = new ArrayList<>();
            if (data != null) {
                for (JsonNode item : data) {
                    JsonNode emb = item.get("embedding");
                    float[] vec = new float[emb.size()];
                    for (int i = 0; i < emb.size(); i++) {
                        vec[i] = emb.get(i).floatValue();
                    }
                    results.add(vec);
                }
            }
            return results;
        } catch (Exception e) {
            log.error("embedding API call failed", e);
            throw new RuntimeException("Embedding 调用失败: " + e.getMessage(), e);
        }
    }

    @Override
    public int dimension() {
        return dimension;
    }
}
