package com.efloow.agenthub.common.trace;

import java.util.Map;
import org.slf4j.MDC;

public final class TraceContext {

    private TraceContext() {
    }

    public static Map<String, String> capture() {
        Map<String, String> context = MDC.getCopyOfContextMap();
        return context != null ? Map.copyOf(context) : Map.of();
    }

    public static void restore(Map<String, String> context) {
        if (context == null || context.isEmpty()) {
            MDC.clear();
            return;
        }
        MDC.setContextMap(context);
    }

    public static Runnable wrap(Runnable runnable) {
        Map<String, String> captured = capture();
        return () -> runWith(captured, runnable);
    }

    public static void runWith(Map<String, String> context, Runnable runnable) {
        Map<String, String> previous = MDC.getCopyOfContextMap();
        try {
            restore(context);
            runnable.run();
        } finally {
            restore(previous);
        }
    }
}
