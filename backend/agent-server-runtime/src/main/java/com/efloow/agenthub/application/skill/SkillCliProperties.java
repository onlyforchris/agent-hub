package com.efloow.agenthub.application.skill;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "agent.skill.cli")
public class SkillCliProperties {

    private boolean enabled = true;
    private long defaultTimeoutMs = 120_000;
    private int maxStdoutBytes = 524_288;
    private String sandbox = "strict";
    private List<String> allowedCommands = new ArrayList<>(List.of(
            "python", "python3", "pandoc", "pdftoppm", "pdftotext", "qpdf"
    ));

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public long getDefaultTimeoutMs() {
        return defaultTimeoutMs;
    }

    public void setDefaultTimeoutMs(long defaultTimeoutMs) {
        this.defaultTimeoutMs = defaultTimeoutMs;
    }

    public int getMaxStdoutBytes() {
        return maxStdoutBytes;
    }

    public void setMaxStdoutBytes(int maxStdoutBytes) {
        this.maxStdoutBytes = maxStdoutBytes;
    }

    public String getSandbox() {
        return sandbox;
    }

    public void setSandbox(String sandbox) {
        this.sandbox = sandbox;
    }

    public List<String> getAllowedCommands() {
        return allowedCommands;
    }

    public void setAllowedCommands(List<String> allowedCommands) {
        this.allowedCommands = allowedCommands;
    }
}
