package com.efloow.agenthub.system.text2sql;

import com.efloow.agenthub.application.embedding.EmbeddingProvider;
import com.efloow.agenthub.system.entity.DataSourceSchemaCache;
import com.efloow.agenthub.system.entity.Text2SqlColumnEmbedding;
import com.efloow.agenthub.system.entity.Text2SqlTableEmbedding;
import com.efloow.agenthub.system.mapper.DataSourceSchemaCacheMapper;
import com.efloow.agenthub.system.mapper.Text2SqlColumnEmbeddingMapper;
import com.efloow.agenthub.system.mapper.Text2SqlTableEmbeddingMapper;
import com.efloow.agenthub.system.text2sql.dto.ForeignKeyInfo;
import com.efloow.agenthub.system.text2sql.dto.RetrievalContext;
import com.efloow.agenthub.system.text2sql.dto.SchemaSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 语义检索：问题 → 向量 → 表/列召回 → FK 图扩展。
 */
@Service
public class Text2SqlRetrievalService {

    private static final Logger log = LoggerFactory.getLogger(Text2SqlRetrievalService.class);
    private static final double SIM_THRESHOLD = 0.5;
    private static final int TABLE_TOP_K = 10;
    private static final int COLUMN_TOP_K = 30;

    private final Text2SqlTableEmbeddingMapper tableEmbMapper;
    private final Text2SqlColumnEmbeddingMapper columnEmbMapper;
    private final DataSourceSchemaCacheMapper schemaCacheMapper;
    private final EmbeddingProvider embeddingProvider;
    private final ObjectMapper objectMapper;

    public Text2SqlRetrievalService(
            Text2SqlTableEmbeddingMapper tableEmbMapper,
            Text2SqlColumnEmbeddingMapper columnEmbMapper,
            DataSourceSchemaCacheMapper schemaCacheMapper,
            EmbeddingProvider embeddingProvider,
            ObjectMapper objectMapper) {
        this.tableEmbMapper = tableEmbMapper;
        this.columnEmbMapper = columnEmbMapper;
        this.schemaCacheMapper = schemaCacheMapper;
        this.embeddingProvider = embeddingProvider;
        this.objectMapper = objectMapper;
    }

    /**
     * 执行完整语义检索。
     *
     * @param connectionId 数据源 ID
     * @param question     用户自然语言问题
     * @return 检索上下文
     */
    public RetrievalContext retrieve(String connectionId, String question) {
        float[] qVec = embeddingProvider.embed(question);
        String vecStr = Text2SqlIndexService.toPgVector(qVec);

        // 1. 表级检索
        List<Text2SqlTableEmbedding> tableResults = tableEmbMapper.searchSimilar(
            connectionId, vecStr, TABLE_TOP_K);
        List<RetrievalContext.ScoredTable> tables = new ArrayList<>();
        Set<String> candidateTableNames = new LinkedHashSet<>();
        for (Text2SqlTableEmbedding t : tableResults) {
            double sim = t.getSimilarity() != null ? t.getSimilarity() : 0;
            if (sim >= SIM_THRESHOLD) {
                tables.add(new RetrievalContext.ScoredTable(
                    t.getTableName(), t.getChunkText(), sim));
                candidateTableNames.add(t.getTableName());
            }
        }

        if (candidateTableNames.isEmpty() && !tableResults.isEmpty()) {
            // 如果全部低于阈值，至少兜底取 Top-3
            for (int i = 0; i < Math.min(3, tableResults.size()); i++) {
                Text2SqlTableEmbedding t = tableResults.get(i);
                tables.add(new RetrievalContext.ScoredTable(
                    t.getTableName(), t.getChunkText(),
                    t.getSimilarity() != null ? t.getSimilarity() : 0));
                candidateTableNames.add(t.getTableName());
            }
        }

        // 2. 列级检索（限定候选表范围）
        List<Text2SqlColumnEmbedding> colResults = columnEmbMapper.searchSimilarInTables(
            connectionId, vecStr, new ArrayList<>(candidateTableNames), COLUMN_TOP_K);
        List<RetrievalContext.ScoredColumn> columns = new ArrayList<>();
        for (Text2SqlColumnEmbedding c : colResults) {
            double sim = c.getSimilarity() != null ? c.getSimilarity() : 0;
            if (sim >= SIM_THRESHOLD) {
                columns.add(new RetrievalContext.ScoredColumn(
                    c.getTableName(), c.getColumnName(), c.getChunkText(), sim));
            }
        }

        // 3. FK 图扩展
        Set<String> expanded = new LinkedHashSet<>();
        List<ForeignKeyInfo> allFks = loadForeignKeys(connectionId);
        List<ForeignKeyInfo> relevantFks = new ArrayList<>();
        for (ForeignKeyInfo fk : allFks) {
            if (candidateTableNames.contains(fk.fromTable())
                || candidateTableNames.contains(fk.toTable())) {
                relevantFks.add(fk);
                if (!candidateTableNames.contains(fk.fromTable())) {
                    expanded.add(fk.fromTable());
                }
                if (!candidateTableNames.contains(fk.toTable())) {
                    expanded.add(fk.toTable());
                }
            }
        }

        log.info("text2sql retrieval: connection={}, question={}, tables={}, cols={}, expanded={}",
            connectionId, truncate(question, 50), tables.size(), columns.size(), expanded.size());

        return new RetrievalContext(tables, columns, new ArrayList<>(expanded), relevantFks);
    }

    private List<ForeignKeyInfo> loadForeignKeys(String connectionId) {
        String cacheId = "conn_" + connectionId;
        DataSourceSchemaCache cache = schemaCacheMapper.selectById(cacheId);
        if (cache == null || cache.getSchemaSnapshot() == null) {
            return List.of();
        }
        try {
            SchemaSnapshot snap = objectMapper.readValue(cache.getSchemaSnapshot(), SchemaSnapshot.class);
            return snap.foreignKeys();
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String truncate(String s, int maxLen) {
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }
}
