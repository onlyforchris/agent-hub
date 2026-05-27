package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.domain.skill.SkillRouteResult;
import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import com.efloow.agenthub.system.config.SkillRoutingProperties;
import com.efloow.agenthub.system.dto.SkillRouteCandidateDto;
import com.efloow.agenthub.system.dto.SkillRouteTestResultDto;
import com.efloow.agenthub.system.service.SkillEmbeddingService;
import com.efloow.agenthub.system.service.SkillEmbeddingService.EmbeddingHit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.AntPathMatcher;

@Service
public class SkillRouter {

    private final SkillRegistrySync registrySync;
    private final SkillEmbeddingService skillEmbeddingService;
    private final SkillRoutingProperties routingProperties;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    public SkillRouter(
            SkillRegistrySync registrySync,
            SkillEmbeddingService skillEmbeddingService,
            SkillRoutingProperties routingProperties
    ) {
        this.registrySync = registrySync;
        this.skillEmbeddingService = skillEmbeddingService;
        this.routingProperties = routingProperties;
    }

    public SkillRouteResult route(
            String inputText,
            String agentId,
            String explicitSkillCode,
            List<String> workspacePaths
    ) {
        List<SkillRuntimeView> candidates = registrySync.candidatesForAgent(agentId);

        if (explicitSkillCode != null && !explicitSkillCode.isBlank()) {
            SkillRuntimeView skill = registrySync.getByCode(explicitSkillCode);
            if (skill != null) {
                return new SkillRouteResult(skill.skillCode(), skill, "显式指定 skillCode", "explicit", 1.0);
            }
        }

        PathMatch bestPath = findBestPathMatch(candidates, workspacePaths);
        if (bestPath != null) {
            return new SkillRouteResult(
                    bestPath.skill().skillCode(),
                    bestPath.skill(),
                    "paths glob 命中 " + bestPath.matchCount() + " 个文件",
                    "paths",
                    bestPath.score()
            );
        }

        if (inputText != null && !inputText.isBlank()) {
            List<EmbeddingHit> embeddingHits = skillEmbeddingService.search(
                    inputText,
                    agentId,
                    routingProperties.getEmbeddingTopK()
            );
            if (!embeddingHits.isEmpty()) {
                EmbeddingHit best = embeddingHits.get(0);
                if (best.score() >= routingProperties.getEmbeddingMinScore()) {
                    SkillRuntimeView skill = registrySync.getByCode(best.skillCode());
                    if (skill != null && skill.autoInvoke()) {
                        return new SkillRouteResult(
                                skill.skillCode(),
                                skill,
                                best.reason(),
                                "embedding",
                                best.score()
                        );
                    }
                }
            }

            String lower = inputText.toLowerCase(Locale.ROOT);
            List<ScoredSkill> scored = new ArrayList<>();
            for (SkillRuntimeView skill : candidates) {
                if (!skill.autoInvoke()) {
                    continue;
                }
                double score = scoreText(lower, skill);
                if (score > 0) {
                    scored.add(new ScoredSkill(skill, score));
                }
            }
            scored.sort(Comparator.comparingDouble(ScoredSkill::score).reversed());
            if (!scored.isEmpty()) {
                ScoredSkill best = scored.get(0);
                return new SkillRouteResult(
                        best.skill().skillCode(),
                        best.skill(),
                        "关键词/描述匹配",
                        "keyword",
                        best.score()
                );
            }
        }

        SkillRuntimeView defaultSkill = registrySync.defaultForAgent(agentId);
        if (defaultSkill != null) {
            return new SkillRouteResult(
                    defaultSkill.skillCode(),
                    defaultSkill,
                    "Agent 默认 Skill",
                    "default",
                    0.5
            );
        }

        return new SkillRouteResult(null, null, "未命中 Skill", "none", 0);
    }

    public SkillRouteTestResultDto testRoute(
            String inputText,
            String agentId,
            List<String> workspacePaths,
            int topK
    ) {
        SkillRouteResult selected = route(inputText, agentId, null, workspacePaths);
        Map<String, SkillRouteCandidateDto> merged = new LinkedHashMap<>();

        if (selected.skillCode() != null) {
            merged.put(selected.skillCode(), toCandidate(selected.skillCode(), selected.score(),
                    selected.reason(), selected.matchedBy()));
        }

        PathMatch pathMatch = findBestPathMatch(registrySync.candidatesForAgent(agentId), workspacePaths);
        if (pathMatch != null) {
            merged.putIfAbsent(pathMatch.skill().skillCode(), toCandidate(
                    pathMatch.skill().skillCode(),
                    pathMatch.score(),
                    "paths glob 命中",
                    "paths"
            ));
        }

        if (inputText != null && !inputText.isBlank()) {
            for (EmbeddingHit hit : skillEmbeddingService.search(inputText, agentId, topK)) {
                merged.putIfAbsent(hit.skillCode(), toCandidate(
                        hit.skillCode(), hit.score(), hit.reason(), "embedding"));
            }

            String lower = inputText.toLowerCase(Locale.ROOT);
            registrySync.candidatesForAgent(agentId).stream()
                    .filter(SkillRuntimeView::autoInvoke)
                    .forEach(skill -> {
                        double score = scoreText(lower, skill);
                        if (score > 0) {
                            merged.putIfAbsent(skill.skillCode(), toCandidate(
                                    skill.skillCode(), score, "描述相似度", "keyword"));
                        }
                    });
        }

        List<SkillRouteCandidateDto> candidates = merged.values().stream()
                .sorted(Comparator.comparingDouble(SkillRouteCandidateDto::getScore).reversed())
                .limit(Math.max(topK, 1))
                .toList();

        SkillRouteTestResultDto result = new SkillRouteTestResultDto();
        result.setSelectedSkillCode(selected.skillCode());
        result.setCandidates(candidates);
        return result;
    }

    private SkillRouteCandidateDto toCandidate(String code, double score, String reason, String matchedBy) {
        SkillRouteCandidateDto dto = new SkillRouteCandidateDto();
        dto.setSkillCode(code);
        dto.setScore(score);
        dto.setReason(reason);
        dto.setMatchedBy(matchedBy);
        return dto;
    }

    private PathMatch findBestPathMatch(List<SkillRuntimeView> candidates, List<String> workspacePaths) {
        if (workspacePaths == null || workspacePaths.isEmpty()) {
            return null;
        }
        PathMatch best = null;
        for (SkillRuntimeView skill : candidates) {
            int count = countPathMatches(skill.paths(), workspacePaths);
            if (count <= 0) {
                continue;
            }
            double score = Math.min(0.99, 0.7 + count * 0.05);
            if (best == null || count > best.matchCount() || (count == best.matchCount() && score > best.score())) {
                best = new PathMatch(skill, count, score);
            }
        }
        return best;
    }

    private int countPathMatches(List<String> patterns, List<String> workspacePaths) {
        if (patterns == null || patterns.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (String path : workspacePaths) {
            if (path == null) {
                continue;
            }
            String normalized = normalizePath(path);
            for (String pattern : patterns) {
                if (pattern != null && pathMatcher.match(pattern.trim(), normalized)) {
                    count++;
                    break;
                }
            }
        }
        return count;
    }

    private String normalizePath(String path) {
        return path.replace('\\', '/');
    }

    private double scoreText(String inputLower, SkillRuntimeView skill) {
        double score = 0;
        if (skill.skillCode() != null && inputLower.contains(skill.skillCode().toLowerCase(Locale.ROOT))) {
            score += 0.8;
        }
        if (skill.skillName() != null && inputLower.contains(skill.skillName().toLowerCase(Locale.ROOT))) {
            score += 0.6;
        }
        if (skill.description() != null) {
            String desc = skill.description().toLowerCase(Locale.ROOT);
            for (String token : inputLower.split("\\s+")) {
                if (token.length() >= 2 && desc.contains(token)) {
                    score += 0.15;
                }
            }
        }
        return Math.min(score, 1.0);
    }

    private record ScoredSkill(SkillRuntimeView skill, double score) {}

    private record PathMatch(SkillRuntimeView skill, int matchCount, double score) {}
}
