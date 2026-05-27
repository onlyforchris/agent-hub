package com.efloow.agenthub.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.system.entity.SystemUser;
import com.efloow.agenthub.system.mapper.SystemUserMapper;
import com.efloow.agenthub.system.vo.LoginResponse;
import java.time.LocalDateTime;
import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final SystemUserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final CaptchaService captchaService;
    private final RbacService rbacService;
    private final TokenLifecycleService tokenLifecycleService;

    public AuthService(
            SystemUserMapper userMapper,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            CaptchaService captchaService,
            RbacService rbacService,
            TokenLifecycleService tokenLifecycleService
    ) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.captchaService = captchaService;
        this.rbacService = rbacService;
        this.tokenLifecycleService = tokenLifecycleService;
    }

    @Transactional
    public LoginResponse login(String username, String password, String captchaId, String captchaCode, String clientIp) {
        captchaService.verify(captchaId, captchaCode);
        SystemUser user = userMapper.selectOne(new LambdaQueryWrapper<SystemUser>()
                .eq(SystemUser::getUsername, username.trim())
                .last("limit 1"));
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException("A004_BAD_CREDENTIALS", "账号或密码错误");
        }
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new BusinessException("A005_USER_DISABLED", "账号已停用");
        }
        user.setLastLoginIp(clientIp);
        user.setLastLoginTime(LocalDateTime.now());
        userMapper.updateById(user);
        String nickname = user.getNickname() == null || user.getNickname().isBlank() ? user.getUsername() : user.getNickname();
        String token = jwtTokenService.createAccessToken(user.getId(), user.getUsername(), nickname);
        String refreshToken = jwtTokenService.createRefreshToken(user.getId(), user.getUsername(), nickname);
        tokenLifecycleService.storeRefreshToken(jwtTokenService.verifyRefreshToken(refreshToken));
        return new LoginResponse(
                token,
                refreshToken,
                jwtTokenService.getExpiresInSeconds(),
                user.getId(),
                user.getUsername(),
                nickname,
                rbacService.dataScopeByUser(user.getId()),
                rbacService.permissionsByUser(user.getId()),
                rbacService.menuIdsByUser(user.getId()),
                rbacService.agentIdsByUser(user.getId())
        );
    }

    @Transactional
    public LoginResponse refresh(String refreshToken) {
        Map<String, Object> claims = jwtTokenService.verifyRefreshToken(refreshToken);
        String userId = (String) claims.get("userId");
        if (userId == null || tokenLifecycleService.isTokenBlacklisted(claims)
                || !tokenLifecycleService.isRefreshTokenActive(claims)) {
            throw new BusinessException("A006_UNAUTHORIZED", "refresh token无效或已过期");
        }
        SystemUser user = getEnabledUser(userId);
        if (user == null) {
            throw new BusinessException("A005_USER_DISABLED", "账号已停用");
        }
        String nickname = user.getNickname() == null || user.getNickname().isBlank() ? user.getUsername() : user.getNickname();
        String token = jwtTokenService.createAccessToken(user.getId(), user.getUsername(), nickname);
        return new LoginResponse(
                token,
                refreshToken,
                jwtTokenService.getExpiresInSeconds(),
                user.getId(),
                user.getUsername(),
                nickname,
                rbacService.dataScopeByUser(user.getId()),
                rbacService.permissionsByUser(user.getId()),
                rbacService.menuIdsByUser(user.getId()),
                rbacService.agentIdsByUser(user.getId())
        );
    }

    @Transactional
    public void logout(String accessToken, String userId) {
        if (accessToken != null && !accessToken.isBlank()) {
            Map<String, Object> claims = jwtTokenService.verifyAccessToken(accessToken);
            if (!claims.isEmpty()) {
                tokenLifecycleService.blacklistToken(claims, userId);
            }
        }
        tokenLifecycleService.revokeAllRefreshTokens(userId);
    }

    public SystemUser getEnabledUser(String userId) {
        SystemUser user = userMapper.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            return null;
        }
        return user;
    }
}
