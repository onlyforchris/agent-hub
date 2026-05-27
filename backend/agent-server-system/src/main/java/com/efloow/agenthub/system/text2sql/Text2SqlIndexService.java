package com.efloow.agenthub.system.text2sql;

import com.efloow.agenthub.application.embedding.EmbeddingProvider;
import com.efloow.agenthub.system.entity.DataSourceSchemaCache;
import com.efloow.agenthub.system.entity.Text2SqlColumnEmbedding;
import com.efloow.agenthub.system.entity.Text2SqlTableEmbedding;
import com.efloow.agenthub.system.mapper.DataSourceSchemaCacheMapper;
import com.efloow.agenthub.system.mapper.Text2SqlColumnEmbeddingMapper;
import com.efloow.agenthub.system.mapper.Text2SqlTableEmbeddingMapper;
import com.efloow.agenthub.system.text2sql.dto.ColumnInfo;
import com.efloow.agenthub.system.text2sql.dto.SchemaSnapshot;
import com.efloow.agenthub.system.text2sql.dto.TableInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Schema → 向量索引构建服务。
 */
@Service
public class Text2SqlIndexService {

    private static final Logger log = LoggerFactory.getLogger(Text2SqlIndexService.class);

    private final DataSourceSchemaCacheMapper schemaCacheMapper;
    private final Text2SqlTableEmbeddingMapper tableEmbMapper;
    private final Text2SqlColumnEmbeddingMapper columnEmbMapper;
    private final EmbeddingProvider embeddingProvider;
    private final ObjectMapper objectMapper;

    public Text2SqlIndexService(
            DataSourceSchemaCacheMapper schemaCacheMapper,
            Text2SqlTableEmbeddingMapper tableEmbMapper,
            Text2SqlColumnEmbeddingMapper columnEmbMapper,
            EmbeddingProvider embeddingProvider,
            ObjectMapper objectMapper) {
        this.schemaCacheMapper = schemaCacheMapper;
        this.tableEmbMapper = tableEmbMapper;
        this.columnEmbMapper = columnEmbMapper;
        this.embeddingProvider = embeddingProvider;
        this.objectMapper = objectMapper;
    }

    /**
     * 为指定数据源重建向量索引（先清旧再写入）。
     *
     * @param connectionId 数据源连接 ID
     * @return 写入的向量总数（表级 + 列级）
     */
    @Transactional
    public int buildIndex(String connectionId) {
        String cacheId = "conn_" + connectionId;
        DataSourceSchemaCache cache = schemaCacheMapper.selectById(cacheId);
        if (cache == null || cache.getRefreshStatus() == null || cache.getRefreshStatus() != 1
            || cache.getSchemaSnapshot() == null) {
            throw new IllegalStateException("Schema 缓存未就绪，请先刷新 Schema");
        }
        SchemaSnapshot snapshot;
        try {
            snapshot = objectMapper.readValue(cache.getSchemaSnapshot(), SchemaSnapshot.class);
        } catch (Exception e) {
            throw new IllegalStateException("Schema 缓存解析失败", e);
        }

        // 清旧
        tableEmbMapper.deleteByConnectionId(connectionId);
        columnEmbMapper.deleteByConnectionId(connectionId);

        // 分块
        List<String> tableChunks = new ArrayList<>();
        List<String> tableIds = new ArrayList<>();
        List<String> tableNames = new ArrayList<>();
        for (TableInfo t : snapshot.tables()) {
            String chunk = t.tableName() + " | " + t.tableComment()
                + " | 行数约" + t.rowEstimate();
            tableChunks.add(chunk);
            tableIds.add("t_" + connectionId + "_" + t.tableName());
            tableNames.add(t.tableName());
        }

        List<String> colChunks = new ArrayList<>();
        List<String> colIds = new ArrayList<>();
        List<String> colTableNames = new ArrayList<>();
        List<String> colNames = new ArrayList<>();
        for (TableInfo t : snapshot.tables()) {
            for (ColumnInfo c : t.columns()) {
                StringBuilder sb = new StringBuilder();
                sb.append(t.tableName()).append('.').append(c.name())
                    .append(" | 类型:").append(c.columnType());
                if (!c.comment().isEmpty()) {
                    sb.append(" | ").append(c.comment());
                }
                if (!c.sampleValues().isEmpty()) {
                    sb.append(" | 示例:");
                    sb.append(String.join(", ", c.sampleValues()));
                }
                colChunks.add(sb.toString());
                colIds.add("c_" + connectionId + "_" + t.tableName() + "_" + c.name());
                colTableNames.add(t.tableName());
                colNames.add(c.name());
            }
        }

        // 批量向量化
        log.info("text2sql indexing: connection={}, tables={}, columns={}",
            connectionId, tableChunks.size(), colChunks.size());

        List<float[]> tableVecs = embeddingProvider.embedBatch(tableChunks);
        List<float[]> colVecs = embeddingProvider.embedBatch(colChunks);

        // 写入表级
        LocalDateTime now = LocalDateTime.now();
        for (int i = 0; i < tableChunks.size(); i++) {
            Text2SqlTableEmbedding emb = new Text2SqlTableEmbedding();
            emb.setId(tableIds.get(i));
            emb.setConnectionId(connectionId);
            emb.setTableName(tableNames.get(i));
            emb.setChunkText(tableChunks.get(i));
            emb.setEmbedding(toPgVector(tableVecs.get(i)));
            emb.setStatus(1);
            emb.setCreateTime(now);
            emb.setUpdateTime(now);
            tableEmbMapper.insert(emb);
        }

        // 写入列级
        for (int i = 0; i < colChunks.size(); i++) {
            Text2SqlColumnEmbedding emb = new Text2SqlColumnEmbedding();
            emb.setId(colIds.get(i));
            emb.setConnectionId(connectionId);
            emb.setTableName(colTableNames.get(i));
            emb.setColumnName(colNames.get(i));
            emb.setChunkText(colChunks.get(i));
            emb.setEmbedding(toPgVector(colVecs.get(i)));
            emb.setStatus(1);
            emb.setCreateTime(now);
            emb.setUpdateTime(now);
            columnEmbMapper.insert(emb);
        }

        int total = tableChunks.size() + colChunks.size();
        log.info("text2sql indexing done: connection={}, total={}", connectionId, total);
        return total;
    }

    /**
     * float[] → pgvector 字符串 "[x1, x2, ...]"
     */
    static String toPgVector(float[] vec) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vec.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(vec[i]);
        }
        sb.append(']');
        return sb.toString();
    }
}
