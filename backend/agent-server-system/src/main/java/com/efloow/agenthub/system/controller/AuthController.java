package com.efloow.agenthub.system.controller;

import com.efloow.agenthub.common.response.R;
import com.efloow.agenthub.system.dto.LoginRequest;
import com.efloow.agenthub.system.dto.RefreshTokenRequest;
import com.efloow.agenthub.system.entity.SystemUser;
import com.efloow.agenthub.system.service.AuthService;
import com.efloow.agenthub.system.service.CaptchaService;
import com.efloow.agenthub.system.service.RbacService;
import com.efloow.agenthub.system.vo.CaptchaResponse;
import com.efloow.agenthub.system.vo.LoginResponse;
import com.efloow.agenthub.system.vo.UserInfoResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final CaptchaService captchaService;
    private final RbacService rbacService;

    public AuthController(AuthService authService, CaptchaService captchaService, RbacService rbacService) {
        this.authService = authService;
        this.captchaService = captchaService;
        this.rbacService = rbacService;
    }

    @GetMapping("/captcha")
    public R<CaptchaResponse> captcha() {
        return R.ok(captchaService.createCaptcha());
    }

    @PostMapping("/login")
    public R<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        LoginResponse response = authService.login(
                request.username(),
                request.password(),
                request.captchaId(),
                request.captchaCode(),
                getClientIp(servletRequest)
        );
        return R.ok(response);
    }

    @GetMapping("/me")
    public R<UserInfoResponse> me(Authentication authentication) {
        SystemUser user = (SystemUser) authentication.getPrincipal();
        return R.ok(new UserInfoResponse(
                user.getId(),
                user.getUsername(),
                user.getNickname(),
                user.getDepartmentId(),
                user.getEmail(),
                user.getPhone(),
                rbacService.dataScopeByUser(user.getId()),
                rbacService.permissionsByUser(user.getId()),
                rbacService.menuIdsByUser(user.getId()),
                rbacService.agentIdsByUser(user.getId())
        ));
    }

    @PostMapping("/logout")
    public R<Void> logout(Authentication authentication, HttpServletRequest request) {
        if (authentication != null && authentication.getPrincipal() instanceof SystemUser user) {
            authService.logout(resolveBearerToken(request), user.getId());
        }
        return R.ok(null);
    }

    @PostMapping("/refresh")
    public R<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return R.ok(authService.refresh(request.refreshToken()));
    }

    private String getClientIp(HttpServletRequest request) {
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

    private String resolveBearerToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring(7);
        }
        return null;
    }
}
