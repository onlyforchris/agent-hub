package com.efloow.agenthub.system.dto;

import java.util.List;
import java.util.Map;

public class AgentSkillMountSyncRequest {

    private List<MountItem> mounts;

    public List<MountItem> getMounts() {
        return mounts;
    }

    public void setMounts(List<MountItem> mounts) {
        this.mounts = mounts;
    }

    public static class MountItem {

        private String skillId;
        private String skillCode;
        private Boolean isDefault;
        private Integer sortOrder;
        private Map<String, Object> policyOverride;

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
}
