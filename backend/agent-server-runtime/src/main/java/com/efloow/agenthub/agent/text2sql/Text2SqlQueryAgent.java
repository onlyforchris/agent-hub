package com.efloow.agenthub.agent.text2sql;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.application.llm.LlmGateway;
import com.efloow.agenthub.base.AgentBase;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.common.util.AesUtil;
import com.efloow.agenthub.domain.agent.AgentInfo;
import com.efloow.agenthub.domain.agent.AgentResult;
import com.efloow.agenthub.domain.agent.Intent;
import com.efloow.agenthub.domain.agent.SessionContext;
import com.efloow.agenthub.system.entity.Text2SqlDataConnection;
import com.efloow.agenthub.system.mapper.Text2SqlDataConnectionMapper;
import com.efloow.agenthub.system.text2sql.MySqlJdbcHelper;
import com.efloow.agenthub.system.text2sql.Text2SqlPromptBuilder;
import com.efloow.agenthub.system.text2sql.Text2SqlRetrievalService;
import com.efloow.agenthub.system.text2sql.dto.RetrievalContext;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlQueryResult;
import com.efloow.agenthub.text2sql.SqlSafetyValidator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Text2SQL 自然语言查数 Agent。
 * 链路：语义检索 → Prompt 组装 → LLM 生成 SQL → 静态校验 → JDBC 只读执行 → 结果返回。
 */
@Component
public class Text2SqlQueryAgent extends AgentBase {

    @Autowired private Text2SqlRetrievalService retrievalService;
    @Autowired private Text2SqlPromptBuilder promptBuilder;
    @Autowired private Text2SqlDataConnectionMapper connectionMapper;

    @Value("${agent.llm.encryption-secret:${efloow.encryption.secret:efloow-model-key-2026}}")
    private String encryptionSecret;

    @Override
    public AgentInfo info() {
        return AgentInfo.builder()
            .id("text2sql-query")
            .name("Text2SQL 查数")
            .description("连接外部 MySQL 数据源，自然语言提问自动生成 SQL 并执行查询")
            .permissionLevel(1)
            .skills(List.of(
                new AgentInfo.SkillInfo("query", "自然语言查数", "输入问题，自动检索Schema、生成SQL、执行并返回结果")
            ))
            .build();
    }

    @Override
    public String routeHint() {
        return "自然语言查数、问数、SQL查询、数据统计、汇总、报表查询、TMS资金数据查询";
    }

    @Override
    public String preferredModel() {
        return "deepseek-chat";
    }

    @Override
    public Intent classify(String input, SessionContext ctx) {
        String connectionId = ctx.variables() != null
            ? (String) ctx.variables().get("text2sqlConnectionId")
            : null;
        return new Intent("query", Map.of(
            "connectionId", connectionId != null ? connectionId : "",
            "question", input
        ));
    }

    @Override
    public AgentResult doExecute(Intent intent, SessionContext ctx) {
        String connectionId = (String) intent.params().getOrDefault("connectionId", "");
        String question = (String) intent.params().getOrDefault("question", "");

        if (question.isBlank()) {
            throw new BusinessException("A001_INVALID_INPUT", "请输入查询问题");
        }

        // 1. 确定数据源
        Text2SqlDataConnection conn;
        if (!connectionId.isBlank()) {
            conn = connectionMapper.selectById(connectionId);
        } else {
            conn = pickDefaultConnection();
        }
        if (conn == null || conn.getStatus() != 1) {
            throw new BusinessException("D001_CONNECTION_NOT_FOUND", "未找到可用数据源，请先在系统连接器配置");
        }

        // 2. 语义检索
        RetrievalContext retrievalCtx;
        try {
            retrievalCtx = retrievalService.retrieve(conn.getId(), question);
        } catch (Exception e) {
            log.warn("text2sql retrieval failed, using empty context: {}", e.getMessage());
            retrievalCtx = new RetrievalContext(List.of(), List.of(), List.of(), List.of());
        }

        // 3. Prompt 组装
        String prompt = promptBuilder.build(conn.getId(), question, retrievalCtx, conn.getDbType());

        // 4. LLM 生成 SQL
        LlmGateway.LlmResult llmResult = llmGateway.chat(
            "deepseek", preferredModel(),
            List.of(LlmGateway.Message.system(prompt), LlmGateway.Message.user(question)),
            new LlmGateway.LlmOptions(0.3, 4096, Map.of())
        );

        String sql = extractSql(llmResult.content());
        if (sql == null || sql.isBlank()) {
            throw new BusinessException("L001_LLM_NO_SQL",
                "LLM 未能生成有效 SQL，请重试或简化问题。\nLLM 响应: " + truncate(llmResult.content(), 200));
        }

        // 5. 静态校验
        Set<String> allowedTables = retrievalCtx.allTableNames();
        SqlSafetyValidator.ValidationResult validation = SqlSafetyValidator.validate(sql, allowedTables);
        if (!validation.passed()) {
            throw new BusinessException("T002_SQL_REJECTED",
                "SQL 校验未通过: " + validation.rejectReason()
                + "\n生成 SQL: " + sql
                + "\n白名单表: " + allowedTables);
        }

        String safeSql = validation.sanitizedSql();
        String password = AesUtil.decrypt(conn.getPasswordEnc(), encryptionSecret);
        String jdbcUrl = MySqlJdbcHelper.buildJdbcUrl(
            conn.getHost(), conn.getPort(), conn.getDatabaseName(), conn.getJdbcParams());

        // 6. JDBC 执行
        try {
            Text2SqlQueryResult queryResult = MySqlJdbcHelper.executeReadOnlyQuery(
                jdbcUrl, conn.getUsername(), password, safeSql, 10, 1000);

            return AgentResult.of(
                "查询完成，共返回 " + queryResult.rowCount() + " 条记录。",
                Map.of(
                    "question", question,
                    "sql", safeSql,
                    "columns", queryResult.columns(),
                    "rows", queryResult.rows(),
                    "rowCount", queryResult.rowCount(),
                    "executionMs", queryResult.executionMs()
                )
            );
        } catch (Exception e) {
            log.error("text2sql JDBC execution failed: {}", e.getMessage());
            throw new BusinessException("D002_QUERY_FAILED",
                "查询执行失败: " + e.getMessage()
                + "\nSQL: " + safeSql
                + "\n请检查数据源连接和 SQL 是否正确");
        }
    }

    private Text2SqlDataConnection pickDefaultConnection() {
        var wrapper = new LambdaQueryWrapper<Text2SqlDataConnection>()
            .eq(Text2SqlDataConnection::getDbType, "MYSQL")
            .eq(Text2SqlDataConnection::getStatus, 1)
            .last("LIMIT 1");
        List<Text2SqlDataConnection> list = connectionMapper.selectList(wrapper);
        return list.isEmpty() ? null : list.get(0);
    }

    static String extractSql(String content) {
        if (content == null || content.isBlank()) return null;
        String upper = content.toUpperCase();
        // <sql>...</sql>
        int tagStart = content.indexOf("<sql>");
        int tagEnd = content.indexOf("</sql>");
        if (tagStart >= 0 && tagEnd > tagStart) {
            return content.substring(tagStart + 5, tagEnd).strip();
        }
        // JSON "sql": "..."
        int keyIdx = content.indexOf("\"sql\"");
        if (keyIdx >= 0) {
            int colon = content.indexOf(':', keyIdx);
            int start = content.indexOf('"', colon + 1);
            int end = content.indexOf('"', start + 1);
            if (start >= 0 && end > start) {
                return content.substring(start + 1, end)
                    .replace("\\\"", "\"").replace("\\n", "\n");
            }
        }
        // SQL keyword pattern
        for (String kw : new String[]{"SELECT", "WITH"}) {
            int idx = upper.indexOf(kw);
            if (idx >= 0) {
                String sub = content.substring(idx);
                int endIdx = sub.indexOf("```");
                if (endIdx > 0) sub = sub.substring(0, endIdx);
                // strip trailing JSON/closing braces
                sub = sub.replaceFirst("[\"}\\]]+\\s*$", "");
                return sub.strip();
            }
        }
        return null;
    }

    private static String truncate(String s, int maxLen) {
        return s != null && s.length() > maxLen ? s.substring(0, maxLen) + "..." : s;
    }
}
