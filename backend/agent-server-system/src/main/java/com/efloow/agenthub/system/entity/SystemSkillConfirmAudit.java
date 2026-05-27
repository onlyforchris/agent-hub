package com.efloow.agenthub.system.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.efloow.agenthub.system.mybatis.JsonbStringTypeHandler;
import java.time.LocalDateTime;
import org.apache.ibatis.type.JdbcType;

@TableName(value = "sys_skill_confirm_audit", autoResultMap = true)
public class SystemSkillConfirmAudit {

    @TableId
    private String id;
    private String traceId;
    private String sessionId;
    private String userId;
    private String skillCode;
    private String skillVersion;
    private String confirmId;
    private String actionType;
    private String actionFingerprint;
    private String riskLevel;

    @TableField(value = "policy_snapshot", jdbcType = JdbcType.OTHER, typeHandler = JsonbStringTypeHandler.class)
    private String policySnapshot;

    @TableField(value = "confirm_payload", jdbcType = JdbcType.OTHER, typeHandler = JsonbStringTypeHandler.class)
    private String confirmPayload;

    private String decision;
    private String decisionComment;
    private LocalDateTime decidedAt;
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

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getSkillCode() {
        return skillCode;
    }

    public void setSkillCode(String skillCode) {
        this.skillCode = skillCode;
    }

    public String getSkillVersion() {
        return skillVersion;
    }

    public void setSkillVersion(String skillVersion) {
        this.skillVersion = skillVersion;
    }

    public String getConfirmId() {
        return confirmId;
    }

    public void setConfirmId(String confirmId) {
        this.confirmId = confirmId;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getActionFingerprint() {
        return actionFingerprint;
    }

    public void setActionFingerprint(String actionFingerprint) {
        this.actionFingerprint = actionFingerprint;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public String getPolicySnapshot() {
        return policySnapshot;
    }

    public void setPolicySnapshot(String policySnapshot) {
        this.policySnapshot = policySnapshot;
    }

    public String getConfirmPayload() {
        return confirmPayload;
    }

    public void setConfirmPayload(String confirmPayload) {
        this.confirmPayload = confirmPayload;
    }

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public String getDecisionComment() {
        return decisionComment;
    }

    public void setDecisionComment(String decisionComment) {
        this.decisionComment = decisionComment;
    }

    public LocalDateTime getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(LocalDateTime decidedAt) {
        this.decidedAt = decidedAt;
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
