package com.efloow.agenthub.system.dto;

import java.util.List;

public class SkillSummaryDto {

    private String id;
    private String skillCode;
    private String skillName;
    private String description;
    private String category;
    private List<String> tags;
    private String sideEffectLevel;
    private Boolean autoInvoke;
    private Boolean isEnabled;
    private String version;
    private String publishStatus;

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

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public String getSideEffectLevel() {
        return sideEffectLevel;
    }

    public void setSideEffectLevel(String sideEffectLevel) {
        this.sideEffectLevel = sideEffectLevel;
    }

    public Boolean getAutoInvoke() {
        return autoInvoke;
    }

    public void setAutoInvoke(Boolean autoInvoke) {
        this.autoInvoke = autoInvoke;
    }

    public Boolean getIsEnabled() {
        return isEnabled;
    }

    public void setIsEnabled(Boolean isEnabled) {
        this.isEnabled = isEnabled;
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
}
