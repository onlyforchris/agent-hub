package com.efloow.agenthub.system.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

/**
 * 外部数据源 Schema 缓存快照。
 */
@TableName("data_source_schema_cache")
public class DataSourceSchemaCache {

    @TableId
    private String id;
    private String connectionId;
    private String dbType;
    @TableField("schema_snapshot")
    private String schemaSnapshot;
    @TableField("sample_values")
    private String sampleValues;
    private LocalDateTime refreshedAt;
    private Integer refreshStatus;
    private String refreshError;
    private Integer status;
    private String remark;
    private String createBy;
    private LocalDateTime createTime;
    private String updateBy;
    private LocalDateTime updateTime;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getConnectionId() {
        return connectionId;
    }

    public void setConnectionId(String connectionId) {
        this.connectionId = connectionId;
    }

    public String getDbType() {
        return dbType;
    }

    public void setDbType(String dbType) {
        this.dbType = dbType;
    }

    public String getSchemaSnapshot() {
        return schemaSnapshot;
    }

    public void setSchemaSnapshot(String schemaSnapshot) {
        this.schemaSnapshot = schemaSnapshot;
    }

    public String getSampleValues() {
        return sampleValues;
    }

    public void setSampleValues(String sampleValues) {
        this.sampleValues = sampleValues;
    }

    public LocalDateTime getRefreshedAt() {
        return refreshedAt;
    }

    public void setRefreshedAt(LocalDateTime refreshedAt) {
        this.refreshedAt = refreshedAt;
    }

    public Integer getRefreshStatus() {
        return refreshStatus;
    }

    public void setRefreshStatus(Integer refreshStatus) {
        this.refreshStatus = refreshStatus;
    }

    public String getRefreshError() {
        return refreshError;
    }

    public void setRefreshError(String refreshError) {
        this.refreshError = refreshError;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public String getCreateBy() {
        return createBy;
    }

    public void setCreateBy(String createBy) {
        this.createBy = createBy;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }

    public String getUpdateBy() {
        return updateBy;
    }

    public void setUpdateBy(String updateBy) {
        this.updateBy = updateBy;
    }

    public LocalDateTime getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(LocalDateTime updateTime) {
        this.updateTime = updateTime;
    }
}
