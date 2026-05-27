package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.domain.agent.SessionContext;
import com.efloow.agenthub.domain.skill.SkillRouteResult;
import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import org.springframework.stereotype.Service;

@Service
public class SkillContextBinder {

    private final SkillRouter skillRouter;
    private final SkillSessionHolder sessionHolder;

    public SkillContextBinder(SkillRouter skillRouter, SkillSessionHolder sessionHolder) {
        this.skillRouter = skillRouter;
        this.sessionHolder = sessionHolder;
    }

    public SkillRouteResult bind(
            SessionContext ctx,
            String agentId,
            String inputText,
            String explicitSkillCode,
            java.util.List<String> workspacePaths
    ) {
        SkillRouteResult result = skillRouter.route(inputText, agentId, explicitSkillCode, workspacePaths);
        if (result.skill() != null) {
            applyToContext(ctx, result.skill());
        }
        return result;
    }

    public void applyToContext(SessionContext ctx, SkillRuntimeView skill) {
        sessionHolder.bind(skill);
        ctx.put("skillCode", skill.skillCode());
        ctx.put("skillName", skill.skillName());
        ctx.put("skillVersion", skill.version());
        ctx.put("skillPolicy", skill.policy());
        ctx.put("skillContextMode", skill.contextMode() != null ? skill.contextMode() : "inline");
        if (skill.contentMd() != null && !skill.contentMd().isBlank()) {
            ctx.put("skillContentMd", skill.contentMd());
        }
    }

    public void clear() {
        sessionHolder.clear();
    }
}
