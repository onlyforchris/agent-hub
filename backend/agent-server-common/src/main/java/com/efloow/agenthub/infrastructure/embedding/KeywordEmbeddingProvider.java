package com.efloow.agenthub.infrastructure.embedding;

import com.efloow.agenthub.application.embedding.EmbeddingProvider;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 基于关键词重叠的轻量 Embedding，零外部依赖。
 * 将文本分词后映射到 1024 维向量（哈希桶），语义相近的文本余弦距离更近。
 *
 * 适用场景：开发调试、离线环境、BGE ONNX 未就绪时的过渡方案。
 * 局限性：无法理解同义词，精度不如 BGE。生产环境建议替换为 BgeEmbeddingProvider。
 */
public class KeywordEmbeddingProvider implements EmbeddingProvider {

    private static final int DIM = 1024;

    @Override
    public float[] embed(String text) {
        List<float[]> results = embedBatch(List.of(text));
        return results.isEmpty() ? new float[DIM] : results.get(0);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        // 构建全局词表
        Map<String, Integer> wordIdx = new HashMap<>();
        List<String[]> tokenized = new ArrayList<>();
        int nextIdx = 0;
        for (String text : texts) {
            String[] words = tokenize(text);
            tokenized.add(words);
            for (String w : words) {
                if (!wordIdx.containsKey(w)) {
                    wordIdx.put(w, nextIdx++);
                }
            }
        }

        List<float[]> results = new ArrayList<>();
        for (String[] words : tokenized) {
            float[] vec = new float[DIM];
            for (String w : words) {
                Integer idx = wordIdx.get(w);
                if (idx != null) {
                    // 哈希到固定维度
                    int bucket = Math.abs(w.hashCode()) % DIM;
                    vec[bucket] += 1.0f;
                }
            }
            // L2 归一化
            float sumSq = 0;
            for (float v : vec) {
                sumSq += v * v;
            }
            if (sumSq > 0) {
                float norm = (float) Math.sqrt(sumSq);
                for (int i = 0; i < DIM; i++) {
                    vec[i] /= norm;
                }
            }
            results.add(vec);
        }
        return results;
    }

    @Override
    public int dimension() {
        return DIM;
    }

    /** 中文简单分词：按非字母数字/非中文字符分割，同时保留连续中文字符和连续英文字母数字。 */
    static String[] tokenize(String text) {
        if (text == null || text.isBlank()) {
            return new String[0];
        }
        Set<String> tokens = new HashSet<>();
        // 提取连续的中文字符
        java.util.regex.Matcher cnMatcher = java.util.regex.Pattern.compile("[\\u4e00-\\u9fa5]+")
            .matcher(text);
        while (cnMatcher.find()) {
            String cn = cnMatcher.group();
            // 按字拆分（保留语义完整性折中）
            tokens.add(cn.toLowerCase());
        }
        // 提取连续的英文/数字
        java.util.regex.Matcher enMatcher = java.util.regex.Pattern.compile("[a-zA-Z0-9_]+")
            .matcher(text);
        while (enMatcher.find()) {
            tokens.add(enMatcher.group().toLowerCase());
        }
        return tokens.toArray(new String[0]);
    }
}
