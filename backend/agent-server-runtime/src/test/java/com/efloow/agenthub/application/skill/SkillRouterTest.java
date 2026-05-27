package com.efloow.agenthub.application.skill;

import com.efloow.agenthub.domain.skill.SkillRouteResult;
import com.efloow.agenthub.domain.skill.SkillRuntimeView;
import com.efloow.agenthub.system.config.SkillRoutingProperties;
import com.efloow.agenthub.system.service.SkillEmbeddingService;
import com.efloow.agenthub.system.service.SkillEmbeddingService.EmbeddingHit;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SkillRouterTest {

    private SkillRegistrySync registrySync;
    private SkillEmbeddingService embeddingService;
    private SkillRouter router;

    @BeforeEach
    void setUp() {
        registrySync = mock(SkillRegistrySync.class);
        embeddingService = mock(SkillEmbeddingService.class);
        SkillRoutingProperties props = new SkillRoutingProperties();
        props.setEmbeddingMinScore(0.35);
        router = new SkillRouter(registrySync, embeddingService, props);
    }

    @Test
    void routesByWorkspacePaths() {
        SkillRuntimeView docx = sampleSkill("docx", List.of("**/*.docx"));
        when(registrySync.candidatesForAgent("document")).thenReturn(List.of(docx));

        SkillRouteResult result = router.route(
                "help me",
                "document",
                null,
                List.of("workspace/input/report.docx")
        );

        assertEquals("docx", result.skillCode());
        assertEquals("paths", result.matchedBy());
    }

    @Test
    void routesByEmbeddingWhenPathsMiss() {
        SkillRuntimeView pdf = sampleSkill("pdf", List.of("**/*.pdf"));
        when(registrySync.candidatesForAgent("document")).thenReturn(List.of(pdf));
        when(registrySync.getByCode("pdf")).thenReturn(pdf);
        when(embeddingService.search(anyString(), anyString(), anyInt()))
                .thenReturn(List.of(new EmbeddingHit("id-pdf", "pdf", 0.82, "pgvector")));

        SkillRouteResult result = router.route(
                "merge two pdf files",
                "document",
                null,
                List.of()
        );

        assertEquals("pdf", result.skillCode());
        assertEquals("embedding", result.matchedBy());
    }

    @Test
    void explicitSkillCodeHasHighestPriority() {
        SkillRuntimeView docx = sampleSkill("docx", List.of("**/*.docx"));
        when(registrySync.getByCode("docx")).thenReturn(docx);

        SkillRouteResult result = router.route(
                "anything",
                "document",
                "docx",
                List.of("other.xlsx")
        );

        assertNotNull(result.skill());
        assertEquals("explicit", result.matchedBy());
    }

    private SkillRuntimeView sampleSkill(String code, List<String> paths) {
        return new SkillRuntimeView(
                "id-" + code,
                code,
                code,
                "document skill",
                "1.0.0",
                "# body",
                paths,
                Map.of(),
                "inline",
                true,
                true,
                "medium"
        );
    }
}
