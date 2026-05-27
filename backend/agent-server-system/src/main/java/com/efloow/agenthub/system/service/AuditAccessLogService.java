package com.efloow.agenthub.system.service;

import com.efloow.agenthub.system.entity.SystemUser;
import com.efloow.agenthub.system.mapper.AuditAccessMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AuditAccessLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditAccessLogService.class);

    private final AuditAccessMapper auditAccessMapper;

    public AuditAccessLogService(AuditAccessMapper auditAccessMapper) {
        this.auditAccessMapper = auditAccessMapper;
    }

    public void record(HttpServletRequest request, int status, long responseTimeMs, Instant requestTime) {
        if (!request.getRequestURI().startsWith("/api/")) {
            return;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        SystemUser user = authentication != null && authentication.getPrincipal() instanceof SystemUser systemUser
                ? systemUser
                : null;
        String auditId = UUID.randomUUID().toString();
        String resourceCode = attribute(request, "rbac.resourceCode");
        String denyReason = attribute(request, "rbac.denyReason");
        String accessResult = result(status, denyReason);
        String traceId = traceId();

        log.info("audit access: traceId={}, method={}, uri={}, result={}, user={}, ip={}, durationMs={}",
            traceId, request.getMethod(), request.getRequestURI(), accessResult,
            user != null ? user.getUsername() : "anonymous", clientIp(request), responseTimeMs);

        auditAccessMapper.insertAccess(
                auditId,
                traceId,
                user == null ? null : user.getId(),
                user == null ? null : user.getUsername(),
                request.getMethod(),
                request.getRequestURI(),
                resourceCode,
                accessResult,
                denyReason == null ? denyReason(status) : denyReason,
                clientIp(request),
                request.getHeader("User-Agent"),
                requestTime,
                responseTimeMs,
                "GRANTED".equals(accessResult) ? 1 : 0,
                null,
                user == null ? null : user.getId()
        );
        if (shouldRecordDetail(request, status)) {
            auditAccessMapper.insertDetail(
                    UUID.randomUUID().toString(),
                    auditId,
                    null,
                    request.getQueryString(),
                    null,
                    request.getMethod() + " " + request.getRequestURI(),
                    1,
                    null,
                    user == null ? null : user.getId()
            );
        }
    }

    public List<Map<String, Object>> listRecent(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return auditAccessMapper.selectRecent(safeLimit);
    }

    private String result(int status, String denyReason) {
        if ("UNREGISTERED_RESOURCE".equals(denyReason)) {
            return "UNREGISTERED";
        }
        if (status == 401) {
            return "UNAUTHORIZED";
        }
        if (status == 403) {
            return "DENIED";
        }
        if (status >= 400) {
            return "FAILED";
        }
        return "GRANTED";
    }

    private boolean shouldRecordDetail(HttpServletRequest request, int status) {
        if (status == 401 || status == 403) {
            return true;
        }
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String path = request.getRequestURI();
        return path.startsWith("/api/rbac/users")
                || path.startsWith("/api/rbac/roles")
                || path.startsWith("/api/rbac/resources")
                || path.startsWith("/api/agents");
    }

    private String denyReason(int status) {
        if (status == 401) {
            return "UNAUTHORIZED";
        }
        if (status == 403) {
            return "FORBIDDEN";
        }
        return null;
    }

    private String traceId() {
        String traceId = MDC.get("traceId");
        return traceId == null || traceId.isBlank() ? UUID.randomUUID().toString() : traceId;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp;
        }
        return request.getRemoteAddr();
    }

    private String attribute(HttpServletRequest request, String name) {
        Object value = request.getAttribute(name);
        return value == null ? null : String.valueOf(value);
    }
}
