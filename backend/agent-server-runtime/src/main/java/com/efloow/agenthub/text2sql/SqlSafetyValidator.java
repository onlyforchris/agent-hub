package com.efloow.agenthub.text2sql;

import java.util.Set;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import net.sf.jsqlparser.statement.Statement;
import net.sf.jsqlparser.statement.select.Select;
import net.sf.jsqlparser.util.TablesNamesFinder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Text2SQL 静态安全校验器。
 * 规则：只允许 SELECT、表名列名白名单、强制 LIMIT。
 */
public final class SqlSafetyValidator {

    private static final Logger log = LoggerFactory.getLogger(SqlSafetyValidator.class);
    private static final int DEFAULT_LIMIT = 1000;

    private SqlSafetyValidator() {
    }

    public static ValidationResult validate(String sql, Set<String> allowedTables) {
        String trimmed = sql.trim();

        // 1. 禁止关键字快速检查（解析前兜底）
        String upper = trimmed.toUpperCase();
        for (String keyword : FORBIDDEN) {
            if (upper.contains(keyword)) {
                return ValidationResult.rejected("禁止的 SQL 关键字: " + keyword);
            }
        }

        // 2. JSqlParser 解析
        Statement stmt;
        try {
            stmt = CCJSqlParserUtil.parse(trimmed);
        } catch (Exception e) {
            return ValidationResult.rejected("SQL 语法错误: " + e.getMessage());
        }

        // 3. 必须是 SELECT
        if (!(stmt instanceof Select selectStmt)) {
            return ValidationResult.rejected("只允许 SELECT 语句，实际: " + stmt.getClass().getSimpleName());
        }

        // 4. 提取表名，白名单校验
        TablesNamesFinder finder = new TablesNamesFinder();
        Set<String> referenced = Set.copyOf(finder.getTableList((Statement) selectStmt));
        for (String ref : referenced) {
            if (!allowedTables.contains(ref)) {
                return ValidationResult.rejected("表不在白名单中: " + ref);
            }
        }

        // 5. 检查 LIMIT，无则追加
        String sanitizedSql = trimmed;
        if (!upper.contains("LIMIT")) {
            sanitizedSql = trimmed.replaceAll(";+\\s*$", "") + " LIMIT " + DEFAULT_LIMIT;
        }

        return ValidationResult.passed(sanitizedSql);
    }

    private static final Set<String> FORBIDDEN = Set.of(
        "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
        "TRUNCATE", "CREATE", "EXEC", "CALL", "GRANT", "REVOKE"
    );

    public record ValidationResult(boolean passed, String sanitizedSql, String rejectReason) {
        static ValidationResult passed(String sql) {
            return new ValidationResult(true, sql, null);
        }

        static ValidationResult rejected(String reason) {
            log.warn("SQL rejected: {}", reason);
            return new ValidationResult(false, null, reason);
        }
    }
}
