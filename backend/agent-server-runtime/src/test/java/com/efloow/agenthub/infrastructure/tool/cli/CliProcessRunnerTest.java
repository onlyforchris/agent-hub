package com.efloow.agenthub.infrastructure.tool.cli;

import com.efloow.agenthub.application.skill.SkillCliProperties;
import com.efloow.agenthub.common.exception.BusinessException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CliProcessRunnerTest {

    private CliProcessRunner runner;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        SkillCliProperties props = new SkillCliProperties();
        props.setAllowedCommands(List.of("python", "python3"));
        runner = new CliProcessRunner(props);
    }

    @Test
    void rejectsShellInvocation() {
        assertThrows(BusinessException.class, () ->
                runner.run(List.of("bash", "-c", "echo hi"), tempDir, null, 5_000L));
    }

    @Test
    void rejectsDisallowedCommand() {
        assertThrows(BusinessException.class, () ->
                runner.run(List.of("curl", "https://example.com"), tempDir, null, 5_000L));
    }

    @Test
    void runsPythonScript(@TempDir Path scriptDir) throws Exception {
        Path script = scriptDir.resolve("hello.py");
        Files.writeString(script, "print('ok')");
        String python = System.getProperty("os.name", "").toLowerCase().contains("win") ? "python" : "python3";
        CliProcessResult result = runner.run(List.of(python, script.toString()), scriptDir, null, 10_000L);
        assertEquals(0, result.exitCode());
        assertTrue(result.stdout().contains("ok"));
    }
}
