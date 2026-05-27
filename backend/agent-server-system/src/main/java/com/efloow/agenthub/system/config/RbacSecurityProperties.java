package com.efloow.agenthub.system.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "rbac.security")
public class RbacSecurityProperties {

    private UnregisteredResourcePolicy unregisteredResourcePolicy = UnregisteredResourcePolicy.DENY;

    private List<String> publicPaths = new ArrayList<>(List.of(
            "/api/auth/captcha",
            "/api/auth/login",
            "/api/auth/refresh",
            "/actuator/health",
            "/v3/api-docs/**",
            "/swagger-ui.html",
            "/swagger-ui/**"
    ));

    private List<String> authenticatedPaths = new ArrayList<>(List.of(
            "/api/auth/me",
            "/api/rbac/menus/routes",
            "/api/agent/**",
            "/api/notifications/**",
            "/api/todos/**"
    ));

    public UnregisteredResourcePolicy getUnregisteredResourcePolicy() {
        return unregisteredResourcePolicy;
    }

    public void setUnregisteredResourcePolicy(UnregisteredResourcePolicy unregisteredResourcePolicy) {
        this.unregisteredResourcePolicy = unregisteredResourcePolicy;
    }

    public List<String> getPublicPaths() {
        return publicPaths;
    }

    public void setPublicPaths(List<String> publicPaths) {
        this.publicPaths = publicPaths;
    }

    public List<String> getAuthenticatedPaths() {
        return authenticatedPaths;
    }

    public void setAuthenticatedPaths(List<String> authenticatedPaths) {
        this.authenticatedPaths = authenticatedPaths;
    }

    public enum UnregisteredResourcePolicy {
        ALLOW,
        DENY
    }
}
