package com.efloow.agenthub.system.security;

import com.efloow.agenthub.system.service.AuditAccessLogService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuditAccessFilter extends OncePerRequestFilter {

    private final AuditAccessLogService auditAccessLogService;

    public AuditAccessFilter(AuditAccessLogService auditAccessLogService) {
        this.auditAccessLogService = auditAccessLogService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Instant requestTime = Instant.now();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long responseTimeMs = Instant.now().toEpochMilli() - requestTime.toEpochMilli();
            try {
                auditAccessLogService.record(request, response.getStatus(), responseTimeMs, requestTime);
            } catch (Exception ignored) {
            }
        }
    }
}
