package com.efloow.agenthub.infrastructure.tool.cli;

import com.efloow.agenthub.application.skill.SkillCliProperties;
import com.efloow.agenthub.common.exception.BusinessException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

/**
 * Skill 包脚本与系统 CLI 的统一子进程执行器。
 * 禁止 shell 字符串拼接，仅接受 argv 列表。
 */
@Service
public class CliProcessRunner {

    private static final Logger log = LoggerFactory.getLogger(CliProcessRunner.class);

    private static final List<String> FORBIDDEN_SHELL = List.of("sh", "bash", "cmd", "powershell", "pwsh");

    private final SkillCliProperties cliProperties;

    public CliProcessRunner(SkillCliProperties cliProperties) {
        this.cliProperties = cliProperties;
    }

    public CliProcessResult run(List<String> argv, Path workingDir, Map<String, String> extraEnv, Long timeoutMs) {
        if (!cliProperties.isEnabled()) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "CLI 执行已禁用");
        }
        if (argv == null || argv.isEmpty()) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "CLI argv 不能为空");
        }
        assertArgvSafe(argv);
        assertWorkingDirSafe(workingDir);

        long timeout = timeoutMs != null ? timeoutMs : cliProperties.getDefaultTimeoutMs();
        List<String> command = new ArrayList<>(argv);
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(workingDir.toFile());
        builder.redirectErrorStream(false);
        builder.environment().clear();
        builder.environment().put("PATH", System.getenv().getOrDefault("PATH", ""));
        if (extraEnv != null) {
            extraEnv.forEach(builder.environment()::put);
        }

        long start = System.currentTimeMillis();
        String traceId = MDC.get("traceId");
        log.info("cli start: traceId={}, cwd={}, argv={}", traceId, workingDir, redactArgv(command));

        try {
            Process process = builder.start();
            ByteArrayOutputStream stdoutBuf = new ByteArrayOutputStream();
            ByteArrayOutputStream stderrBuf = new ByteArrayOutputStream();
            Thread outReader = new Thread(() -> pump(process.getInputStream(), stdoutBuf), "cli-stdout");
            Thread errReader = new Thread(() -> pump(process.getErrorStream(), stderrBuf), "cli-stderr");
            outReader.start();
            errReader.start();

            boolean finished = process.waitFor(timeout, TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                outReader.join(200);
                errReader.join(200);
                log.warn("cli timeout: traceId={}, argv={}", traceId, redactArgv(command));
                throw new BusinessException("T011_CLI_TIMEOUT", "CLI 执行超时");
            }
            outReader.join(500);
            errReader.join(500);

            int exitCode = process.exitValue();
            long durationMs = System.currentTimeMillis() - start;
            String stdout = truncate(stdoutBuf.toString(StandardCharsets.UTF_8));
            String stderr = truncate(stderrBuf.toString(StandardCharsets.UTF_8));
            log.info("cli done: traceId={}, exitCode={}, durationMs={}, stdoutLen={}",
                    traceId, exitCode, durationMs, stdout.length());

            if (exitCode != 0) {
                throw new BusinessException("T012_CLI_EXIT_NONZERO",
                        "CLI 退出码 " + exitCode + ": " + summarize(stderr, stdout));
            }
            return new CliProcessResult(exitCode, stdout, stderr, durationMs);
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("T011_CLI_TIMEOUT", "CLI 执行被中断");
        } catch (IOException e) {
            log.error("cli io error: argv={}", redactArgv(command), e);
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "CLI 启动失败: " + e.getMessage());
        }
    }

    private void assertArgvSafe(List<String> argv) {
        String command = argv.get(0);
        String baseName = Path.of(command).getFileName().toString().toLowerCase(Locale.ROOT);
        if (FORBIDDEN_SHELL.contains(baseName)) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "禁止 shell 调用: " + baseName);
        }
        if (argv.stream().anyMatch(arg -> arg != null && (arg.contains("\n") || arg.contains("\0")))) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "argv 含非法字符");
        }
        if ("strict".equalsIgnoreCase(cliProperties.getSandbox())) {
            boolean allowed = cliProperties.getAllowedCommands().stream()
                    .anyMatch(item -> item.equalsIgnoreCase(baseName));
            if (!allowed) {
                throw new BusinessException("T010_CLI_NOT_ALLOWED", "命令不在白名单: " + baseName);
            }
        } else {
            log.warn("cli relaxed sandbox: command={}", baseName);
            boolean allowed = cliProperties.getAllowedCommands().stream()
                    .anyMatch(item -> item.equalsIgnoreCase(baseName));
            if (!allowed) {
                throw new BusinessException("T010_CLI_NOT_ALLOWED", "命令不在白名单: " + baseName);
            }
        }
    }

    private void assertWorkingDirSafe(Path workingDir) {
        if (workingDir == null) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "工作目录不能为空");
        }
        Path normalized = workingDir.toAbsolutePath().normalize();
        if (!Files.isDirectory(normalized)) {
            try {
                Files.createDirectories(normalized);
            } catch (IOException e) {
                throw new BusinessException("T010_CLI_NOT_ALLOWED", "工作目录不可用: " + normalized);
            }
        }
        String pathText = normalized.toString();
        if (pathText.contains("..")) {
            throw new BusinessException("T010_CLI_NOT_ALLOWED", "工作目录非法");
        }
    }

    private void pump(java.io.InputStream input, ByteArrayOutputStream output) {
        try {
            input.transferTo(output);
        } catch (IOException e) {
            log.debug("cli stream pump interrupted: {}", e.getMessage());
        }
    }

    private String truncate(String text) {
        if (text == null) {
            return "";
        }
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= cliProperties.getMaxStdoutBytes()) {
            return text;
        }
        return new String(bytes, 0, cliProperties.getMaxStdoutBytes(), StandardCharsets.UTF_8) + "...[truncated]";
    }

    private String summarize(String stderr, String stdout) {
        String message = stderr != null && !stderr.isBlank() ? stderr : stdout;
        if (message == null) {
            return "";
        }
        return message.length() > 500 ? message.substring(0, 500) + "..." : message;
    }

    private List<String> redactArgv(List<String> argv) {
        return argv.stream().map(arg -> arg != null && arg.length() > 120 ? arg.substring(0, 120) + "..." : arg).toList();
    }
}
