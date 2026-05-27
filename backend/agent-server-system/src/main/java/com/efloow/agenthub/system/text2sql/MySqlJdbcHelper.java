package com.efloow.agenthub.system.text2sql;

import com.efloow.agenthub.system.text2sql.dto.ColumnInfo;
import com.efloow.agenthub.system.text2sql.dto.ForeignKeyInfo;
import com.efloow.agenthub.system.text2sql.dto.SchemaSnapshot;
import com.efloow.agenthub.system.text2sql.dto.TableInfo;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlMetadataResponse;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlQueryResult;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlTableMetaVo;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * MySQL JDBC 连通性与元数据读取；不记录密码。
 */
public final class MySqlJdbcHelper {

    private static final Pattern SAFE_TOKEN = Pattern.compile("^[a-zA-Z0-9_.\\-]+$");
    private static final Pattern SAFE_JDBC_PARAMS = Pattern.compile("^[a-zA-Z0-9_=&%.:\\-/]+$");
    private static final Pattern SENSITIVE_COL = Pattern.compile(
        ".*(password|secret|token|key|passwd|pwd|credential).*", Pattern.CASE_INSENSITIVE);
    private static final int SAMPLE_ROW_LIMIT = 2;

    private MySqlJdbcHelper() {
    }

    /**
     * 校验主机、库名等标识符，降低 JDBC URL 注入风险。
     */
    public static void assertSafeToken(String label, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " 不能为空");
        }
        if (value.length() > 256 || !SAFE_TOKEN.matcher(value).matches()) {
            throw new IllegalArgumentException(label + " 含非法字符或过长");
        }
    }

    public static void assertSafeJdbcParams(String jdbcParams) {
        if (jdbcParams == null || jdbcParams.isBlank()) {
            return;
        }
        if (jdbcParams.length() > 512 || !SAFE_JDBC_PARAMS.matcher(jdbcParams).matches()) {
            throw new IllegalArgumentException("jdbcParams 含非法字符或过长");
        }
    }

    public static String buildJdbcUrl(String host, int port, String databaseName, String jdbcParams) {
        assertSafeToken("host", host);
        assertSafeToken("databaseName", databaseName);
        assertSafeJdbcParams(jdbcParams);
        StringBuilder sb = new StringBuilder();
        sb.append("jdbc:mysql://").append(host).append(':').append(port).append('/').append(databaseName);
        sb.append("?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=Asia%2FShanghai");
        if (jdbcParams != null && !jdbcParams.isBlank()) {
            sb.append('&');
            if (jdbcParams.startsWith("&")) {
                sb.append(jdbcParams.substring(1));
            } else {
                sb.append(jdbcParams);
            }
        }
        return sb.toString();
    }

    /**
     * 建立连接并执行 {@code SELECT 1} 验证账号可用。
     */
    public static void validateConnection(String jdbcUrl, String username, String password) throws SQLException {
        DriverManager.setLoginTimeout(15);
        try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password);
             var st = conn.prepareStatement("SELECT 1");
             var rs = st.executeQuery()) {
            if (!rs.next()) {
                throw new SQLException("连接成功但未返回结果");
            }
        }
    }

    /**
     * 读取当前库下的表与视图名称，供后续 text2sql 选表。
     */
    public static Text2SqlMetadataResponse loadTableMetadata(String jdbcUrl, String username, String password,
            String databaseName) throws SQLException {
        assertSafeToken("databaseName", databaseName);
        List<Text2SqlTableMetaVo> tables = new ArrayList<>();
        String sql = "SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES "
            + "WHERE TABLE_SCHEMA = ? AND TABLE_TYPE IN ('BASE TABLE','VIEW') ORDER BY TABLE_NAME";
        DriverManager.setLoginTimeout(15);
        try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password);
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, databaseName);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    tables.add(new Text2SqlTableMetaVo(rs.getString(1), rs.getString(2)));
                }
            }
        }
        return new Text2SqlMetadataResponse(tables);
    }

    /**
     * 采集完整 Schema 快照：表信息、列详情、外键、示例行。
     */
    public static SchemaSnapshot loadSchemaSnapshot(String jdbcUrl, String username, String password,
            String databaseName) throws SQLException {
        assertSafeToken("databaseName", databaseName);
        DriverManager.setLoginTimeout(15);
        try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password)) {
            List<TableInfo> tables = loadTables(conn, databaseName);
            Map<String, List<ColumnInfo>> columnMap = loadColumns(conn, databaseName);
            List<ForeignKeyInfo> foreignKeys = loadForeignKeys(conn, databaseName);
            // 将列信息归入对应表并采集示例行
            List<TableInfo> result = new ArrayList<>();
            for (TableInfo table : tables) {
                List<ColumnInfo> cols = columnMap.getOrDefault(table.tableName(), List.of());
                List<List<String>> sampleRows = loadSampleRows(conn, table.tableName(), cols);
                result.add(new TableInfo(
                    table.tableName(), table.tableComment(), table.rowEstimate(), cols, sampleRows));
            }
            return new SchemaSnapshot(result, foreignKeys);
        }
    }

    private static List<TableInfo> loadTables(Connection conn, String schema) throws SQLException {
        String sql = "SELECT TABLE_NAME, TABLE_COMMENT, TABLE_ROWS "
            + "FROM information_schema.TABLES "
            + "WHERE TABLE_SCHEMA = ? AND TABLE_TYPE IN ('BASE TABLE','VIEW') "
            + "ORDER BY TABLE_NAME";
        List<TableInfo> tables = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, schema);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    tables.add(new TableInfo(
                        rs.getString("TABLE_NAME"),
                        nullToEmpty(rs.getString("TABLE_COMMENT")),
                        rs.getLong("TABLE_ROWS"),
                        List.of(),
                        List.of()
                    ));
                }
            }
        }
        return tables;
    }

    private static Map<String, List<ColumnInfo>> loadColumns(Connection conn, String schema) throws SQLException {
        String sql = "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, "
            + "IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT "
            + "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? "
            + "ORDER BY TABLE_NAME, ORDINAL_POSITION";
        Map<String, List<ColumnInfo>> map = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, schema);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    String colName = rs.getString("COLUMN_NAME");
                    boolean pk = "PRI".equals(rs.getString("COLUMN_KEY"));
                    List<String> sampleValues = List.of();
                    // 对非敏感文本列：随后采集示例值
                    if (!SENSITIVE_COL.matcher(colName).matches()) {
                        String dataType = rs.getString("DATA_TYPE");
                        if (isTextType(dataType)) {
                            sampleValues = loadColumnSample(conn, tableName, colName);
                        }
                    }
                    ColumnInfo col = new ColumnInfo(
                        colName,
                        rs.getString("DATA_TYPE"),
                        rs.getString("COLUMN_TYPE"),
                        "YES".equals(rs.getString("IS_NULLABLE")),
                        pk,
                        nullToEmpty(rs.getString("COLUMN_COMMENT")),
                        sampleValues
                    );
                    map.computeIfAbsent(tableName, k -> new ArrayList<>()).add(col);
                }
            }
        }
        return map;
    }

    private static List<ForeignKeyInfo> loadForeignKeys(Connection conn, String schema) throws SQLException {
        String sql = "SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, "
            + "REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME "
            + "FROM information_schema.KEY_COLUMN_USAGE "
            + "WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL "
            + "ORDER BY TABLE_NAME";
        List<ForeignKeyInfo> fks = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, schema);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    fks.add(new ForeignKeyInfo(
                        rs.getString("CONSTRAINT_NAME"),
                        rs.getString("TABLE_NAME"),
                        rs.getString("COLUMN_NAME"),
                        rs.getString("REFERENCED_TABLE_NAME"),
                        rs.getString("REFERENCED_COLUMN_NAME")
                    ));
                }
            }
        }
        return fks;
    }

    private static List<List<String>> loadSampleRows(Connection conn, String tableName, List<ColumnInfo> cols)
            throws SQLException {
        List<String> safeNames = cols.stream()
            .map(ColumnInfo::name)
            .filter(n -> !SENSITIVE_COL.matcher(n).matches())
            .toList();
        if (safeNames.isEmpty()) {
            return List.of();
        }
        String colsStr = safeNames.stream()
            .map(n -> "`" + n + "`")
            .reduce((a, b) -> a + ", " + b).orElse("*");
        String sql = "SELECT " + colsStr + " FROM `" + tableName + "` LIMIT " + SAMPLE_ROW_LIMIT;
        List<List<String>> rows = new ArrayList<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                List<String> row = new ArrayList<>();
                for (String name : safeNames) {
                    String val = rs.getString(name);
                    row.add(val == null ? "NULL" : val);
                }
                rows.add(row);
            }
        } catch (SQLException ignored) {
            // 某些视图或权限不足的表可能查询失败，跳过即可
        }
        return rows;
    }

    private static List<String> loadColumnSample(Connection conn, String tableName, String colName) {
        String sql = "SELECT DISTINCT `" + colName + "` FROM `" + tableName
            + "` WHERE `" + colName + "` IS NOT NULL LIMIT 3";
        List<String> vals = new ArrayList<>();
        try (Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            while (rs.next()) {
                String v = rs.getString(1);
                if (v != null && v.length() > 200) {
                    v = v.substring(0, 200);
                }
                vals.add(v);
            }
        } catch (SQLException ignored) {
        }
        return vals;
    }

    private static boolean isTextType(String dataType) {
        if (dataType == null) {
            return false;
        }
        String t = dataType.toLowerCase();
        return t.contains("char") || t.contains("text") || t.equals("enum") || t.equals("set");
    }

    /**
     * 执行只读 SELECT 查询，返回列名 + 行数据。
     *
     * @param timeoutSeconds 查询超时秒数
     * @param maxRows        结果集最大行数
     */
    public static Text2SqlQueryResult executeReadOnlyQuery(
            String jdbcUrl, String username, String password,
            String sql, int timeoutSeconds, int maxRows) throws SQLException {
        DriverManager.setLoginTimeout(15);
        try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password)) {
            conn.setReadOnly(true);
            long start = System.currentTimeMillis();
            try (Statement st = conn.createStatement()) {
                st.setQueryTimeout(timeoutSeconds);
                st.setMaxRows(maxRows + 1);
                try (ResultSet rs = st.executeQuery(sql)) {
                    var meta = rs.getMetaData();
                    int colCount = meta.getColumnCount();
                    List<String> columns = new ArrayList<>();
                    for (int i = 1; i <= colCount; i++) {
                        columns.add(meta.getColumnLabel(i));
                    }
                    List<List<String>> rows = new ArrayList<>();
                    int count = 0;
                    while (rs.next() && count < maxRows) {
                        List<String> row = new ArrayList<>();
                        for (int i = 1; i <= colCount; i++) {
                            String val = rs.getString(i);
                            row.add(val == null ? "" : val);
                        }
                        rows.add(row);
                        count++;
                    }
                    long elapsed = System.currentTimeMillis() - start;
                    return new Text2SqlQueryResult(
                        null, sql, columns, rows, count, elapsed, null);
                }
            }
        }
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
