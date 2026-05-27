package com.efloow.agenthub.system.security;

import com.efloow.agenthub.system.entity.SystemUser;
import com.efloow.agenthub.system.service.AuthService;
import com.efloow.agenthub.system.service.JwtTokenService;
import com.efloow.agenthub.system.service.TokenLifecycleService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenService jwtTokenService;
    private final AuthService authService;
    private final TokenLifecycleService tokenLifecycleService;

    public JwtAuthenticationFilter(
            JwtTokenService jwtTokenService,
            AuthService authService,
            TokenLifecycleService tokenLifecycleService
    ) {
        this.jwtTokenService = jwtTokenService;
        this.authService = authService;
        this.tokenLifecycleService = tokenLifecycleService;
    }

    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            Map<String, Object> claims = jwtTokenService.verifyAccessToken(authorization.substring(7));
            String userId = (String) claims.get("userId");
            if (userId != null && !tokenLifecycleService.isTokenBlacklisted(claims)
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                SystemUser user = authService.getEnabledUser(userId);
                if (user != null) {
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            user,
                            null,
                            List.of(new SimpleGrantedAuthority("ROLE_USER"))
                    );
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
