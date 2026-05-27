package com.efloow.agenthub.application.embedding;

import java.util.List;

/**
 * 文本向量化服务接口。
 */
public interface EmbeddingProvider {

    /**
     * 单条文本向量化。
     */
    float[] embed(String text);

    /**
     * 批量文本向量化。
     */
    List<float[]> embedBatch(List<String> texts);

    /**
     * 向量维度。
     */
    int dimension();
}
