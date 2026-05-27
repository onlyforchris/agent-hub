package com.efloow.agenthub.common.trace;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class TraceIdFilter extends OncePerRequestFilter {

    public static final String TRACE_HEADER = "X-Trace-Id";
    public static final String SESSION_HEADER = "X-Session-Id";
    public static final String TURN_HEADER = "X-Turn-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String traceId = resolveHeader(request, TRACE_HEADER, "trace-" + UUID.randomUUID());
        String sessionId = resolveHeader(request, SESSION_HEADER, "");
        String turnId = resolveHeader(request, TURN_HEADER, "");
        MDC.put("traceId", traceId);
        if (!sessionId.isBlank()) {
            MDC.put("sessionId", sessionId);
        }
        if (!turnId.isBlank()) {
            MDC.put("turnId", turnId);
        }
        MDC.put("userId", resolveUserId());
        response.setHeader(TRACE_HEADER, traceId);
        if (!sessionId.isBlank()) {
            response.setHeader(SESSION_HEADER, sessionId);
        }
        if (!turnId.isBlank()) {
            response.setHeader(TURN_HEADER, turnId);
        }
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }

    private String resolveHeader(HttpServletRequest request, String header, String defaultValue) {
        String value = request.getHeader(header);
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }

    private String resolveUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            return auth.getName();
        }
        return "anonymous";
    }
}
