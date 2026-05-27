package com.efloow.agenthub.system.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class SkillDetailDto extends SkillSummaryDto {

    private List<SkillResourceDto> resources = new ArrayList<>();
    private String contentMd;
    private Map<String, Object> frontmatterJson;
    private Map<String, Object> policyJson;
    private List<String> pathsJson;
    private String contextMode;
    private Boolean requireConfirm;
    private String owner;
    private String remark;

    public List<SkillResourceDto> getResources() {
        return resources;
    }

    public void setResources(List<SkillResourceDto> resources) {
        this.resources = resources != null ? resources : new ArrayList<>();
    }

    public String getContentMd() {
        return contentMd;
    }

    public void setContentMd(String contentMd) {
        this.contentMd = contentMd;
    }

    public Map<String, Object> getFrontmatterJson() {
        return frontmatterJson;
    }

    public void setFrontmatterJson(Map<String, Object> frontmatterJson) {
        this.frontmatterJson = frontmatterJson;
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

    public String getContextMode() {
        return contextMode;
    }

    public void setContextMode(String contextMode) {
        this.contextMode = contextMode;
    }

    public Boolean getRequireConfirm() {
        return requireConfirm;
    }

    public void setRequireConfirm(Boolean requireConfirm) {
        this.requireConfirm = requireConfirm;
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
}
