package com.efloow.agenthub.system.dto;

import java.util.List;

public class SkillRouteTestRequest {

    private String inputText;
    private String agentId;
    private List<String> workspacePaths;
    private Integer topK = 5;

    public String getInputText() {
        return inputText;
    }

    public void setInputText(String inputText) {
        this.inputText = inputText;
    }

    public String getAgentId() {
        return agentId;
    }

    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }

    public List<String> getWorkspacePaths() {
        return workspacePaths;
    }

    public void setWorkspacePaths(List<String> workspacePaths) {
        this.workspacePaths = workspacePaths;
    }

    public Integer getTopK() {
        return topK;
    }

    public void setTopK(Integer topK) {
        this.topK = topK;
    }
}
