package com.efloow.agenthub.system.text2sql;

import com.efloow.agenthub.system.entity.DataSourceSchemaCache;
import com.efloow.agenthub.system.entity.Text2SqlSemanticTerm;
import com.efloow.agenthub.system.mapper.DataSourceSchemaCacheMapper;
import com.efloow.agenthub.system.mapper.Text2SqlSemanticTermMapper;
import com.efloow.agenthub.system.text2sql.dto.ColumnInfo;
import com.efloow.agenthub.system.text2sql.dto.ForeignKeyInfo;
import com.efloow.agenthub.system.text2sql.dto.RetrievalContext;
import com.efloow.agenthub.system.text2sql.dto.SchemaSnapshot;
import com.efloow.agenthub.system.text2sql.dto.TableInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * 将 RetrievalContext 组装为 LLM Prompt（DAIL-SQL 风格）。
 */
@Service
public class Text2SqlPromptBuilder {

    private final DataSourceSchemaCacheMapper schemaCacheMapper;
    private final Text2SqlSemanticTermMapper termMapper;
    private final ObjectMapper objectMapper;

    public Text2SqlPromptBuilder(
            DataSourceSchemaCacheMapper schemaCacheMapper,
            Text2SqlSemanticTermMapper termMapper,
            ObjectMapper objectMapper) {
        this.schemaCacheMapper = schemaCacheMapper;
        this.termMapper = termMapper;
        this.objectMapper = objectMapper;
    }

    /**
     * 构建完整的 SQL 生成 Prompt。
     *
     * @param connectionId 数据源 ID
     * @param question     用户自然语言问题
     * @param ctx          语义检索结果
     * @param dbType       数据库类型（mysql / postgresql）
     * @return Prompt 字符串
     */
    public String build(String connectionId, String question, RetrievalContext ctx, String dbType) {
        StringBuilder sb = new StringBuilder();

        // System
        sb.append("你是 ").append(dbType.toUpperCase()).append(" SQL 专家。");
        sb.append("只生成只读 SELECT 语句。");
        sb.append("禁止: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC, CALL。");
        sb.append("结果集必须包含 LIMIT。\n\n");

        // DDL
        sb.append(buildDdlSection(connectionId, ctx));

        // FK
        sb.append(buildFkSection(ctx));

        // Terms
        sb.append(buildTermSection(connectionId, question));

        // Question
        sb.append("=== 当前问题 ===\n");
        sb.append(question);
        sb.append("\n\n");
        sb.append("请以 JSON 格式输出: {\"think\": \"分析思路\", \"sql\": \"SELECT ...\"}");

        return sb.toString();
    }

    private String buildDdlSection(String connectionId, RetrievalContext ctx) {
        SchemaSnapshot snap = loadSnapshot(connectionId);
        if (snap == null) {
            return "";
        }
        Set<String> tableSet = ctx.allTableNames();
        Map<String, TableInfo> tableMap = snap.tables().stream()
            .collect(Collectors.toMap(TableInfo::tableName, t -> t));

        StringBuilder sb = new StringBuilder("=== 相关表结构 ===\n");
        for (String tn : tableSet) {
            TableInfo t = tableMap.get(tn);
            if (t == null) {
                continue;
            }
            sb.append("CREATE TABLE ").append(tn).append(" (\n");
            for (int i = 0; i < t.columns().size(); i++) {
                ColumnInfo c = t.columns().get(i);
                sb.append("    ").append(c.name()).append(" ").append(c.columnType());
                if (c.primaryKey()) {
                    sb.append(" PRIMARY KEY");
                }
                if (!c.comment().isEmpty()) {
                    sb.append(" -- ").append(c.comment());
                }
                if (!c.sampleValues().isEmpty()) {
                    sb.append(" [示例: ").append(String.join(", ", c.sampleValues())).append(']');
                }
                if (i < t.columns().size() - 1) {
                    sb.append(',');
                }
                sb.append('\n');
            }
            sb.append(")");
            if (!t.tableComment().isEmpty()) {
                sb.append(" COMMENT '").append(t.tableComment()).append('\'');
            }
            sb.append(";\n\n");
        }
        return sb.toString();
    }

    private String buildFkSection(RetrievalContext ctx) {
        if (ctx.foreignKeys().isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder("=== 外键关系 ===\n");
        for (ForeignKeyInfo fk : ctx.foreignKeys()) {
            sb.append(fk.fromTable()).append('.').append(fk.fromColumn())
                .append(" -> ")
                .append(fk.toTable()).append('.').append(fk.toColumn());
            if (fk.constraintName() != null && !fk.constraintName().isEmpty()) {
                sb.append(" (").append(fk.constraintName()).append(')');
            }
            sb.append('\n');
        }
        sb.append('\n');
        return sb.toString();
    }

    private String buildTermSection(String connectionId, String question) {
        List<Text2SqlSemanticTerm> terms = termMapper.listByConnection(connectionId);
        if (terms.isEmpty()) {
            return "";
        }
        // 检查问题中是否包含已注册术语
        List<Text2SqlSemanticTerm> matched = terms.stream()
            .filter(t -> question.toLowerCase().contains(t.getTerm().toLowerCase()))
            .toList();
        if (matched.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder("=== 业务术语 ===\n");
        for (Text2SqlSemanticTerm t : matched) {
            sb.append("- ").append(t.getTerm()).append(" → ");
            if (t.getTableName() != null) {
                sb.append(t.getTableName());
                if (t.getColumnName() != null) {
                    sb.append('.').append(t.getColumnName());
                }
            }
            if (t.getFormula() != null && !t.getFormula().isEmpty()) {
                sb.append(" 公式: ").append(t.getFormula());
            }
            if (t.getFilterCondition() != null && !t.getFilterCondition().isEmpty()) {
                sb.append(" 条件: ").append(t.getFilterCondition());
            }
            sb.append('\n');
        }
        sb.append('\n');
        return sb.toString();
    }

    private SchemaSnapshot loadSnapshot(String connectionId) {
        String cacheId = "conn_" + connectionId;
        DataSourceSchemaCache cache = schemaCacheMapper.selectById(cacheId);
        if (cache == null || cache.getSchemaSnapshot() == null) {
            return null;
        }
        try {
            return objectMapper.readValue(cache.getSchemaSnapshot(), SchemaSnapshot.class);
        } catch (Exception e) {
            return null;
        }
    }
}
