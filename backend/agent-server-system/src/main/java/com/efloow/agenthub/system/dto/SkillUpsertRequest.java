package com.efloow.agenthub.system.dto;

import java.util.List;
import java.util.Map;

public class SkillUpsertRequest {

    private String skillCode;
    private String skillName;
    private String description;
    private String category;
    private List<String> tags;
    private String contentMd;
    private Map<String, Object> policyJson;
    private List<String> pathsJson;
    private Boolean autoInvoke;
    private Boolean requireConfirm;
    private String contextMode;
    private String owner;
    private String remark;
    private Integer sortOrder;

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

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public String getContentMd() {
        return contentMd;
    }

    public void setContentMd(String contentMd) {
        this.contentMd = contentMd;
    }

    public Map<String, Object> getPolicyJson() {
        return policyJson;
    }

    public void setPolicyJson(Map<String, Object> policyJson) {
        this.policyJson = policyJson;
    }

    public List<String> getPathsJson() {
        return pathsJson;
    }

    public void setPathsJson(List<String> pathsJson) {
        this.pathsJson = pathsJson;
    }

    public Boolean getAutoInvoke() {
        return autoInvoke;
    }

    public void setAutoInvoke(Boolean autoInvoke) {
        this.autoInvoke = autoInvoke;
    }

    public Boolean getRequireConfirm() {
        return requireConfirm;
    }

    public void setRequireConfirm(Boolean requireConfirm) {
        this.requireConfirm = requireConfirm;
    }

    public String getContextMode() {
        return contextMode;
    }

    public void setContextMode(String contextMode) {
        this.contextMode = contextMode;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(String owner) {
        this.owner = owner;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
