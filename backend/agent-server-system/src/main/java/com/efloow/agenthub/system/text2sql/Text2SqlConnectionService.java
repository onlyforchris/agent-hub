package com.efloow.agenthub.system.text2sql;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.common.util.AesUtil;
import com.efloow.agenthub.system.entity.DataSourceSchemaCache;
import com.efloow.agenthub.system.entity.Text2SqlDataConnection;
import com.efloow.agenthub.system.mapper.DataSourceSchemaCacheMapper;
import com.efloow.agenthub.system.mapper.Text2SqlDataConnectionMapper;
import com.efloow.agenthub.system.text2sql.dto.SchemaSnapshot;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlConnectionCreateRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlConnectionProbeRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlConnectionUpdateRequest;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlConnectionVo;
import com.efloow.agenthub.system.text2sql.dto.Text2SqlMetadataResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Text2SQL 数据源连接维护与 MySQL 连通性检测。
 */
@Service
public class Text2SqlConnectionService {

    private static final Logger log = LoggerFactory.getLogger(Text2SqlConnectionService.class);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String DB_MYSQL = "MYSQL";

    private final Text2SqlDataConnectionMapper connectionMapper;
    private final DataSourceSchemaCacheMapper schemaCacheMapper;
    private final ObjectMapper objectMapper;
    private final String encryptionSecret;

    public Text2SqlConnectionService(
            Text2SqlDataConnectionMapper connectionMapper,
            DataSourceSchemaCacheMapper schemaCacheMapper,
            ObjectMapper objectMapper,
            @Value("${agent.llm.encryption-secret:efloow-model-key-2026}") String encryptionSecret
    ) {
        this.connectionMapper = connectionMapper;
        this.schemaCacheMapper = schemaCacheMapper;
        this.objectMapper = objectMapper;
        this.encryptionSecret = encryptionSecret;
    }

    /**
     * 列出未删除的数据源连接。
     *
     * @return VO 列表
     */
    public List<Text2SqlConnectionVo> listActive() {
        LambdaQueryWrapper<Text2SqlDataConnection> q = new LambdaQueryWrapper<>();
        q.ne(Text2SqlDataConnection::getStatus, 2).orderByDesc(Text2SqlDataConnection::getCreateTime);
        return connectionMapper.selectList(q).stream().map(this::toVo).toList();
    }

    /**
     * 按主键查询未删除的连接。
     *
     * @param id 主键
     * @return VO
     */
    public Text2SqlConnectionVo getActive(String id) {
        Text2SqlDataConnection row = requireActive(id);
        return toVo(row);
    }

    /**
     * 使用请求体参数测试 MySQL 连通性（不落库）。
     *
     * @param body 探测参数
     */
    public void probe(Text2SqlConnectionProbeRequest body) {
        assertMysql(body.dbType());
        try {
            String url = MySqlJdbcHelper.buildJdbcUrl(body.host(), body.port(), body.databaseName(), body.jdbcParams());
            MySqlJdbcHelper.validateConnection(url, body.username(), body.password());
            log.info("text2sql probe ok: host={}, port={}, database={}", body.host(), body.port(), body.databaseName());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("C002_INVALID_PARAM", ex.getMessage());
        } catch (SQLException ex) {
            log.warn("text2sql probe failed: host={}, database={}, err={}", body.host(), body.databaseName(),
                ex.getMessage());
            throw new BusinessException("D001_DB_CONNECT_FAILED",
                "数据库连接失败：" + ex.getMessage());
        }
    }

    /**
     * 使用已保存密文测试连接。
     *
     * @param id 连接主键
     */
    public void testSaved(String id) {
        Text2SqlDataConnection row = requireActive(id);
        assertMysql(row.getDbType());
        String plain = AesUtil.decrypt(row.getPasswordEnc(), encryptionSecret);
        try {
            String url = MySqlJdbcHelper.buildJdbcUrl(row.getHost(), row.getPort(), row.getDatabaseName(),
                row.getJdbcParams());
            MySqlJdbcHelper.validateConnection(url, row.getUsername(), plain);
            log.info("text2sql test saved ok: id={}, host={}", id, row.getHost());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("C002_INVALID_PARAM", ex.getMessage());
        } catch (SQLException ex) {
            log.warn("text2sql test saved failed: id={}, err={}", id, ex.getMessage());
            throw new BusinessException("D001_DB_CONNECT_FAILED",
                "数据库连接失败：" + ex.getMessage());
        }
    }

    /**
     * 拉取已连接库的表清单。
     *
     * @param id 连接主键
     * @return 表元数据
     */
    public Text2SqlMetadataResponse metadata(String id) {
        Text2SqlDataConnection row = requireActive(id);
        assertMysql(row.getDbType());
        String plain = AesUtil.decrypt(row.getPasswordEnc(), encryptionSecret);
        try {
            String url = MySqlJdbcHelper.buildJdbcUrl(row.getHost(), row.getPort(), row.getDatabaseName(),
                row.getJdbcParams());
            return MySqlJdbcHelper.loadTableMetadata(url, row.getUsername(), plain, row.getDatabaseName());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("C002_INVALID_PARAM", ex.getMessage());
        } catch (SQLException ex) {
            log.warn("text2sql metadata failed: id={}, err={}", id, ex.getMessage());
            throw new BusinessException("D002_DB_METADATA_FAILED", "读取表清单失败：" + ex.getMessage());
        }
    }

    /**
     * 新建连接（先探测外部库再落库，探测不走事务避免长事务挂库）。
     *
     * @param body   请求体
     * @param userId 当前用户
     * @return 新主键
     */
    public String create(Text2SqlConnectionCreateRequest body, String userId) {
        assertMysql(body.dbType());
        probe(new Text2SqlConnectionProbeRequest(body.dbType(), body.host(), body.port(), body.databaseName(),
            body.username(), body.password(), body.jdbcParams()));
        return doInsert(body, userId);
    }

    @Transactional
    private String doInsert(Text2SqlConnectionCreateRequest body, String userId) {
        Text2SqlDataConnection row = new Text2SqlDataConnection();
        String id = UUID.randomUUID().toString().replace("-", "");
        row.setId(id);
        row.setDisplayName(body.displayName().trim());
        row.setDbType(DB_MYSQL);
        row.setHost(body.host().trim());
        row.setPort(body.port());
        row.setDatabaseName(body.databaseName().trim());
        row.setUsername(body.username().trim());
        row.setPasswordEnc(AesUtil.encrypt(body.password(), encryptionSecret));
        row.setJdbcParams(trimToNull(body.jdbcParams()));
        row.setRemark(trimToNull(body.remark()));
        row.setStatus(1);
        row.setCreateBy(userId);
        row.setCreateTime(LocalDateTime.now());
        row.setUpdateBy(userId);
        row.setUpdateTime(LocalDateTime.now());
        connectionMapper.insert(row);
        return id;
    }

    /**
     * 更新连接；密码为空则保留原密文。探测外部库不走事务，避免长事务挂库。
     *
     * @param id     主键
     * @param body   请求体
     * @param userId 当前用户
     */
    public void update(String id, Text2SqlConnectionUpdateRequest body, String userId) {
        Text2SqlDataConnection row = requireActive(id);
        assertMysql(row.getDbType());
        if (StringUtils.hasText(body.displayName())) {
            row.setDisplayName(body.displayName().trim());
        }
        if (StringUtils.hasText(body.host())) {
            row.setHost(body.host().trim());
        }
        if (body.port() != null) {
            row.setPort(body.port());
        }
        if (StringUtils.hasText(body.databaseName())) {
            row.setDatabaseName(body.databaseName().trim());
        }
        if (StringUtils.hasText(body.username())) {
            row.setUsername(body.username().trim());
        }
        if (body.jdbcParams() != null) {
            row.setJdbcParams(trimToNull(body.jdbcParams()));
        }
        if (body.remark() != null) {
            row.setRemark(trimToNull(body.remark()));
        }
        String effectivePassword;
        if (StringUtils.hasText(body.password())) {
            row.setPasswordEnc(AesUtil.encrypt(body.password(), encryptionSecret));
            effectivePassword = body.password();
        } else {
            effectivePassword = AesUtil.decrypt(row.getPasswordEnc(), encryptionSecret);
        }
        probe(new Text2SqlConnectionProbeRequest(DB_MYSQL, row.getHost(), row.getPort(), row.getDatabaseName(),
            row.getUsername(), effectivePassword, row.getJdbcParams()));
        doUpdate(row, userId);
    }

    @Transactional
    private void doUpdate(Text2SqlDataConnection row, String userId) {
        row.setUpdateBy(userId);
        row.setUpdateTime(LocalDateTime.now());
        connectionMapper.updateById(row);
    }

    /**
     * 逻辑删除连接。
     *
     * @param id     主键
     * @param userId 当前用户
     */
    @Transactional
    public void delete(String id, String userId) {
        requireActive(id);
        LambdaUpdateWrapper<Text2SqlDataConnection> u = new LambdaUpdateWrapper<>();
        u.eq(Text2SqlDataConnection::getId, id)
            .set(Text2SqlDataConnection::getStatus, 2)
            .set(Text2SqlDataConnection::getUpdateBy, userId)
            .set(Text2SqlDataConnection::getUpdateTime, LocalDateTime.now());
        connectionMapper.update(null, u);
    }

    /**
     * 刷新数据源的完整 Schema 缓存。
     *
     * @param id 连接主键
     */
    public void refreshSchema(String id) {
        Text2SqlDataConnection row = requireActive(id);
        assertMysql(row.getDbType());
        String plain = AesUtil.decrypt(row.getPasswordEnc(), encryptionSecret);
        String cacheId = "conn_" + id;
        SchemaSnapshot snapshot;
        try {
            String url = MySqlJdbcHelper.buildJdbcUrl(row.getHost(), row.getPort(), row.getDatabaseName(),
                row.getJdbcParams());
            snapshot = MySqlJdbcHelper.loadSchemaSnapshot(url, row.getUsername(), plain, row.getDatabaseName());
        } catch (SQLException ex) {
            log.warn("text2sql schema refresh failed: id={}, err={}", id, ex.getMessage());
            upsertCacheRow(cacheId, id, row.getDbType(), null, null, 2, ex.getMessage());
            throw new BusinessException("D002_DB_METADATA_FAILED", "Schema 采集失败：" + ex.getMessage());
        }
        try {
            String schemaJson = objectMapper.writeValueAsString(snapshot);
            upsertCacheRow(cacheId, id, row.getDbType(), schemaJson, null, 1, null);
            log.info("text2sql schema refreshed: id={}, tables={}", id, snapshot.tables().size());
        } catch (Exception ex) {
            throw new BusinessException("C002_INVALID_PARAM", "Schema 序列化失败");
        }
    }

    /**
     * 获取已缓存的 Schema 快照。
     *
     * @param id 连接主键
     * @return Schema 快照
     */
    public SchemaSnapshot getSchema(String id) {
        requireActive(id);
        DataSourceSchemaCache cache = schemaCacheMapper.selectById("conn_" + id);
        if (cache == null || cache.getRefreshStatus() == null || cache.getRefreshStatus() != 1
            || !StringUtils.hasText(cache.getSchemaSnapshot())) {
            throw new BusinessException("D003_CONNECTION_NOT_FOUND", "Schema 尚未刷新，请先执行刷新操作");
        }
        try {
            return objectMapper.readValue(cache.getSchemaSnapshot(), SchemaSnapshot.class);
        } catch (Exception ex) {
            throw new BusinessException("C002_INVALID_PARAM", "Schema 缓存解析失败，请重新刷新");
        }
    }

    @Transactional
    private void upsertCacheRow(String cacheId, String connectionId, String dbType, String schemaJson,
            String sampleJson, int refreshStatus, String refreshError) {
        DataSourceSchemaCache cache = schemaCacheMapper.selectById(cacheId);
        if (cache == null) {
            cache = new DataSourceSchemaCache();
            cache.setId(cacheId);
            cache.setConnectionId(connectionId);
            cache.setDbType(dbType);
            cache.setStatus(1);
            cache.setCreateTime(LocalDateTime.now());
            cache.setUpdateTime(LocalDateTime.now());
        }
        cache.setSchemaSnapshot(schemaJson);
        cache.setSampleValues(sampleJson);
        cache.setRefreshStatus(refreshStatus);
        cache.setRefreshError(refreshError);
        cache.setRefreshedAt(LocalDateTime.now());
        cache.setUpdateTime(LocalDateTime.now());
        if (cache.getCreateTime() == null) {
            cache.setCreateTime(LocalDateTime.now());
        }
        DataSourceSchemaCache existing = schemaCacheMapper.selectById(cacheId);
        if (existing != null) {
            schemaCacheMapper.updateById(cache);
        } else {
            schemaCacheMapper.insert(cache);
        }
    }

    private Text2SqlDataConnection requireActive(String id) {
        Text2SqlDataConnection row = connectionMapper.selectById(id);
        if (row == null || row.getStatus() == null || row.getStatus() == 2) {
            throw new BusinessException("D003_CONNECTION_NOT_FOUND", "数据源不存在或已删除");
        }
        return row;
    }

    private Text2SqlConnectionVo toVo(Text2SqlDataConnection row) {
        boolean pwd = StringUtils.hasText(row.getPasswordEnc());
        return new Text2SqlConnectionVo(
            row.getId(),
            row.getDisplayName(),
            row.getDbType(),
            row.getHost(),
            row.getPort() == null ? 3306 : row.getPort(),
            row.getDatabaseName(),
            row.getUsername(),
            pwd,
            row.getJdbcParams(),
            row.getRemark(),
            row.getCreateBy(),
            row.getCreateTime() == null ? null : row.getCreateTime().format(FMT),
            row.getUpdateTime() == null ? null : row.getUpdateTime().format(FMT)
        );
    }

    private static void assertMysql(String dbType) {
        if (dbType == null || !DB_MYSQL.equalsIgnoreCase(dbType.trim())) {
            throw new BusinessException("C003_UNSUPPORTED_DB", "当前仅支持 MYSQL 数据源");
        }
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
