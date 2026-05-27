package com.efloow.agenthub.infrastructure.embedding;

import com.efloow.agenthub.application.embedding.EmbeddingProvider;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * 测试用 Embedding，返回随机向量。仅用于开发调试，不用于生产。
 */
public class MockEmbeddingProvider implements EmbeddingProvider {

    private static final int DEFAULT_DIM = 1024;
    private final SecureRandom rng = new SecureRandom();

    @Override
    public float[] embed(String text) {
        float[] vec = new float[DEFAULT_DIM];
        for (int i = 0; i < DEFAULT_DIM; i++) {
            vec[i] = rng.nextFloat() * 2 - 1;
        }
        return vec;
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        List<float[]> result = new ArrayList<>();
        for (String t : texts) {
            result.add(embed(t));
        }
        return result;
    }

    @Override
    public int dimension() {
        return DEFAULT_DIM;
    }
}
