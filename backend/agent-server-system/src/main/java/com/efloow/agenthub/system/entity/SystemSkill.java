package com.efloow.agenthub.system.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.efloow.agenthub.system.mybatis.JsonbStringTypeHandler;
import java.time.LocalDateTime;
import org.apache.ibatis.type.JdbcType;

@TableName(value = "sys_skill", autoResultMap = true)
public class SystemSkill {

    @TableId
    private String id;
    private String skillCode;
    private String skillName;
    private String description;
    private String category;

    @TableField(value = "tags", jdbcType = JdbcType.OTHER, typeHandler = JsonbStringTypeHandler.class)
    private String tags;

    private String contentMd;

    @TableField(value = "frontmatter_json", jdbcType = JdbcType.OTHER, typeHandler = JsonbStringTypeHandler.class)
    private String frontmatterJson;

    @TableField(value = "policy_json", jdbcType = JdbcType.OTHER, typeHandler = JsonbStringTypeHandler.class)
    private String policyJson;

    @TableField(value = "paths_json", jdbcType = JdbcType.OTHER, typeHandler = JsonbStringTypeHandler.class)
    private String pathsJson;

    private String sideEffectLevel;
    private String contextMode;
    private Integer autoInvoke;
    private Integer requireConfirm;
    private String version;
    private String publishStatus;
    private Integer isEnabled;
    private Integer sortOrder;
    private String owner;
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

    public String getSkillCode() {
        return skillCode;
    }

    public void setSkillCode(String skillCode) {
        this.skillCode = skillCode;
    }

    public String getSkillName() {
        return skillName;
    }

    public void setSkillName(String skillName) {
        this.skillName = skillName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public String getContentMd() {
        return contentMd;
    }

    public void setContentMd(String contentMd) {
        this.contentMd = contentMd;
    }

    public String getFrontmatterJson() {
        return frontmatterJson;
    }

    public void setFrontmatterJson(String frontmatterJson) {
        this.frontmatterJson = frontmatterJson;
    }

    public String getPolicyJson() {
        return policyJson;
    }

    public void setPolicyJson(String policyJson) {
        this.policyJson = policyJson;
    }

    public String getPathsJson() {
        return pathsJson;
    }

    public void setPathsJson(String pathsJson) {
        this.pathsJson = pathsJson;
    }

    public String getSideEffectLevel() {
        return sideEffectLevel;
    }

    public void setSideEffectLevel(String sideEffectLevel) {
        this.sideEffectLevel = sideEffectLevel;
    }

    public String getContextMode() {
        return contextMode;
    }

    public void setContextMode(String contextMode) {
        this.contextMode = contextMode;
    }

    public Integer getAutoInvoke() {
        return autoInvoke;
    }

    public void setAutoInvoke(Integer autoInvoke) {
        this.autoInvoke = autoInvoke;
    }

    public Integer getRequireConfirm() {
        return requireConfirm;
    }

    public void setRequireConfirm(Integer requireConfirm) {
        this.requireConfirm = requireConfirm;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getPublishStatus() {
        return publishStatus;
    }

    public void setPublishStatus(String publishStatus) {
        this.publishStatus = publishStatus;
    }

    public Integer getIsEnabled() {
        return isEnabled;
    }

    public void setIsEnabled(Integer isEnabled) {
        this.isEnabled = isEnabled;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
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
