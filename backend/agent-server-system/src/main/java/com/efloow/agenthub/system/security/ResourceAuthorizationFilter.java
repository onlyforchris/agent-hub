package com.efloow.agenthub.system.security;

import com.efloow.agenthub.system.config.RbacSecurityProperties;
import com.efloow.agenthub.system.config.RbacSecurityProperties.UnregisteredResourcePolicy;
import com.efloow.agenthub.system.service.RbacService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ResourceAuthorizationFilter extends OncePerRequestFilter {

    private final RbacService rbacService;
    private final RbacSecurityProperties properties;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    public ResourceAuthorizationFilter(RbacService rbacService, RbacSecurityProperties properties) {
        this.rbacService = rbacService;
        this.properties = properties;
    }

    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return true;
    }

    /**
     * 在 JWT 认证完成后执行资源级权限校验。
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if (matches(properties.getPublicPaths(), path)) {
            filterChain.doFilter(request, response);
            return;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }
        if (matches(properties.getAuthenticatedPaths(), path)) {
            filterChain.doFilter(request, response);
            return;
        }
        String permission = rbacService.permissionByMethodAndPath(request.getMethod(), path);
        if (permission != null && !permission.isBlank()) {
            request.setAttribute("rbac.resourceCode", permission);
        }
        if (rbacService.hasSuperAdminRole(rbacService.currentUser())) {
            filterChain.doFilter(request, response);
            return;
        }
        if (permission == null || permission.isBlank()) {
            if (properties.getUnregisteredResourcePolicy() == UnregisteredResourcePolicy.ALLOW) {
                filterChain.doFilter(request, response);
                return;
            }
            request.setAttribute("rbac.denyReason", "UNREGISTERED_RESOURCE");
            writeForbidden(response, "A008_UNREGISTERED_RESOURCE", "未登记的资源路径");
            return;
        }
        try {
            rbacService.assertPermission(permission);
        } catch (AccessDeniedException ex) {
            request.setAttribute("rbac.denyReason", ex.getMessage());
            writeForbidden(response, "A007_FORBIDDEN", ex.getMessage());
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean matches(Iterable<String> patterns, String path) {
        for (String pattern : patterns) {
            if (pathMatcher.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }

    private void writeForbidden(HttpServletResponse response, String code, String message) throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"code\":\"" + code + "\",\"message\":\"" + message + "\",\"data\":null}");
    }
}
