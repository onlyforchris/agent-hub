package com.efloow.agenthub.infrastructure.skill;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class SkillMdParserTest {

    private final SkillMdParser parser = new SkillMdParser(new ObjectMapper());

    @Test
    void parseSkillMdWithFrontmatter() {
        String raw = """
            ---
            name: deploy-staging
            description: Deploy app to staging environment.
            paths:
              - "apps/**"
            disable-model-invocation: true
            ---
            # Deploy

            Run tests first.
            """;

        SkillMdParser.ParsedSkillMd parsed = parser.parse(raw);
        assertEquals("deploy-staging", parsed.name());
        assertEquals("Deploy app to staging environment.", parsed.description());
        assertEquals("# Deploy\n\nRun tests first.", parsed.body());
        assertTrue(parsed.paths().contains("apps/**"));
        assertEquals(Boolean.TRUE, parsed.disableModelInvocation());
    }
}
