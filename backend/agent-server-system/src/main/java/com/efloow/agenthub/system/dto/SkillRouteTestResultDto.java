package com.efloow.agenthub.system.dto;

import java.util.List;

public class SkillRouteTestResultDto {

    private String selectedSkillCode;
    private List<SkillRouteCandidateDto> candidates;

    public String getSelectedSkillCode() {
        return selectedSkillCode;
    }

    public void setSelectedSkillCode(String selectedSkillCode) {
        this.selectedSkillCode = selectedSkillCode;
    }

    public List<SkillRouteCandidateDto> getCandidates() {
        return candidates;
    }

    public void setCandidates(List<SkillRouteCandidateDto> candidates) {
        this.candidates = candidates;
    }
}
