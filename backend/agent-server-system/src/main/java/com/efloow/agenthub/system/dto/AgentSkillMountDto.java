package com.efloow.agenthub.system.dto;

import java.util.Map;

public class AgentSkillMountDto {

    private String id;
    private String agentId;
    private String skillId;
    private String skillCode;
    private String skillName;
    private String description;
    private String sideEffectLevel;
    private Boolean isDefault;
    private Integer sortOrder;
    private Map<String, Object> policyOverride;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAgentId() {
        return agentId;
    }

    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }

    public String getSkillId() {
        return skillId;
    }

    public void setSkillId(String skillId) {
        this.skillId = skillId;
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

    public String getSideEffectLevel() {
        return sideEffectLevel;
    }

    public void setSideEffectLevel(String sideEffectLevel) {
        this.sideEffectLevel = sideEffectLevel;
    }

    public Boolean getIsDefault() {
        return isDefault;
    }

    public void setIsDefault(Boolean isDefault) {
        this.isDefault = isDefault;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Map<String, Object> getPolicyOverride() {
        return policyOverride;
    }

    public void setPolicyOverride(Map<String, Object> policyOverride) {
        this.policyOverride = policyOverride;
    }
}
