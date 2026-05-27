package com.efloow.agenthub.domain.agent;

import java.util.List;
import java.util.Map;

public record AgentInfo(
    String id,
    String name,
    String description,
    int permissionLevel,
    List<String> visibleRoles,
    List<SkillInfo> skills,
    List<String> toolIds
) {

    public record SkillInfo(String key, String name, String description) {}

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String id;
        private String name;
        private String description;
        private int permissionLevel = 1;
        private List<String> visibleRoles = List.of();
        private List<SkillInfo> skills = List.of();
        private List<String> toolIds = List.of();

        public Builder id(String id) { this.id = id; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder permissionLevel(int level) { this.permissionLevel = level; return this; }
        public Builder visibleRoles(List<String> roles) { this.visibleRoles = roles; return this; }
        public Builder skills(List<SkillInfo> skills) { this.skills = skills; return this; }
        public Builder toolIds(List<String> toolIds) { this.toolIds = toolIds; return this; }

        public AgentInfo build() {
            return new AgentInfo(id, name, description, permissionLevel, visibleRoles, skills, toolIds);
        }
    }
}
