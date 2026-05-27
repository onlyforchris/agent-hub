package com.efloow.agenthub.system.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "agent.skill.routing")
public class SkillRoutingProperties {

    private boolean embeddingEnabled = true;
    private int embeddingTopK = 5;
    private double embeddingMinScore = 0.35;
    private String embeddingModelLabel = "skill-routing";

    public boolean isEmbeddingEnabled() {
        return embeddingEnabled;
    }

    public void setEmbeddingEnabled(boolean embeddingEnabled) {
        this.embeddingEnabled = embeddingEnabled;
    }

    public int getEmbeddingTopK() {
        return embeddingTopK;
    }

    public void setEmbeddingTopK(int embeddingTopK) {
        this.embeddingTopK = embeddingTopK;
    }

    public double getEmbeddingMinScore() {
        return embeddingMinScore;
    }

    public void setEmbeddingMinScore(double embeddingMinScore) {
        this.embeddingMinScore = embeddingMinScore;
    }

    public String getEmbeddingModelLabel() {
        return embeddingModelLabel;
    }

    public void setEmbeddingModelLabel(String embeddingModelLabel) {
        this.embeddingModelLabel = embeddingModelLabel;
    }
}
