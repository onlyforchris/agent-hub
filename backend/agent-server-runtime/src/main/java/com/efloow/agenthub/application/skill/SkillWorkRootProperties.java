package com.efloow.agenthub.application.skill;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "agent.skill")
public class SkillWorkRootProperties {

    private String workRoot = System.getProperty("java.io.tmpdir") + "/efloow-skill-work";

    public Path workRoot() {
        return Path.of(workRoot).toAbsolutePath().normalize();
    }

    public String getWorkRoot() {
        return workRoot;
    }

    public void setWorkRoot(String workRoot) {
        this.workRoot = workRoot;
    }
}
