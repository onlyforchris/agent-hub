package com.efloow.agenthub.infrastructure.tool.sandbox;

import com.efloow.agenthub.common.exception.BusinessException;
import groovy.lang.Binding;
import groovy.lang.GroovyShell;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 统一脚本沙箱：仅支持 Groovy（同 JVM，适合数据查询后处理、规则与计算）。
 * 不引入 Python 子进程，避免部署依赖与进程逃逸面。
 */
@Service
public class ScriptSandboxService {

    private static final Logger log = LoggerFactory.getLogger(ScriptSandboxService.class);

    private static final int MAX_SCRIPT_LENGTH = 16_384;
    private static final long TIMEOUT_MS = 3_000;

    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "tool-sandbox-groovy");
        t.setDaemon(true);
        return t;
    });

    public Object evalScript(String script, Map<String, Object> bindings) {
        String normalized = normalizeScript(script);
        assertScript(normalized);
        Binding binding = new Binding();
        if (bindings != null) {
            bindings.forEach(binding::setVariable);
        }
        binding.setVariable("bindings", bindings != null ? bindings : Map.of());
        return runWithTimeout(() -> new GroovyShell(binding).evaluate(normalized));
    }

    /**
     * SQL/JSON 入库时常把换行存成字面量 {@code \n}，Groovy 无法编译，执行前还原为真实换行。
     */
    private String normalizeScript(String script) {
        if (script == null || script.isEmpty()) {
            return script;
        }
        if (!script.contains("\n") && script.contains("\\n")) {
            return script
                    .replace("\\r\\n", "\n")
                    .replace("\\n", "\n")
                    .replace("\\t", "\t");
        }
        return script;
    }

    private void assertScript(String script) {
        if (script == null || script.isBlank()) {
            throw new BusinessException("T002_INVALID_PARAMS", "script 不能为空");
        }
        if (script.length() > MAX_SCRIPT_LENGTH) {
            throw new BusinessException("T003_SCRIPT_TOO_LONG", "脚本过长");
        }
        blockDangerous(script);
    }

    private void blockDangerous(String text) {
        String lower = text.toLowerCase();
        if (lower.contains("runtime.getruntime")
                || lower.contains("processbuilder")
                || lower.contains("class.forname")
                || lower.contains("java.io.")
                || lower.contains("java.nio.")
                || lower.contains("system.exit")
                || lower.contains("exec(")) {
            throw new BusinessException("T004_SCRIPT_FORBIDDEN", "脚本包含禁止的操作");
        }
    }

    private Object runWithTimeout(Callable<Object> task) {
        Future<Object> future = executor.submit(task);
        try {
            return future.get(TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            log.warn("Groovy sandbox timeout");
            throw new BusinessException("T005_SCRIPT_TIMEOUT", "Groovy 执行超时");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Groovy sandbox error: {}", e.getMessage());
            throw new BusinessException("T006_SCRIPT_ERROR", "Groovy 执行失败: " + e.getMessage());
        }
    }
}
