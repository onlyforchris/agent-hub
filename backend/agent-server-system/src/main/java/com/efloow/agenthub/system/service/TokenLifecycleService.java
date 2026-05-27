package com.efloow.agenthub.system.service;

import com.efloow.agenthub.system.mapper.TokenMapper;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TokenLifecycleService {

    private final TokenMapper tokenMapper;

    public TokenLifecycleService(TokenMapper tokenMapper) {
        this.tokenMapper = tokenMapper;
    }

    @Transactional
    public void storeRefreshToken(Map<String, Object> claims) {
        String userId = stringClaim(claims, "userId");
        tokenMapper.insertRefreshToken(
                UUID.randomUUID().toString(),
                stringClaim(claims, "jti"),
                userId,
                expiresAt(claims),
                userId
        );
    }

    @Transactional
    public void blacklistToken(Map<String, Object> claims, String invalidatedBy) {
        String tokenId = stringClaim(claims, "jti");
        if (tokenId == null || tokenMapper.existsBlacklistedToken(tokenId)) {
            return;
        }
        tokenMapper.insertTokenBlacklist(
                UUID.randomUUID().toString(),
                tokenId,
                stringClaim(claims, "userId"),
                stringClaim(claims, "tokenType"),
                expiresAt(claims),
                invalidatedBy,
                invalidatedBy
        );
    }

    @Transactional
    public void revokeRefreshToken(Map<String, Object> claims) {
        String userId = stringClaim(claims, "userId");
        tokenMapper.revokeRefreshToken(stringClaim(claims, "jti"), userId, userId);
    }

    @Transactional
    public void revokeAllRefreshTokens(String userId) {
        tokenMapper.revokeAllRefreshTokensByUserId(userId, userId);
    }

    public boolean isTokenBlacklisted(Map<String, Object> claims) {
        String tokenId = stringClaim(claims, "jti");
        return tokenId != null && tokenMapper.existsBlacklistedToken(tokenId);
    }

    public boolean isRefreshTokenActive(Map<String, Object> claims) {
        String tokenId = stringClaim(claims, "jti");
        return tokenId != null && tokenMapper.existsActiveRefreshToken(tokenId);
    }

    private String stringClaim(Map<String, Object> claims, String key) {
        Object value = claims.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private LocalDateTime expiresAt(Map<String, Object> claims) {
        Number exp = (Number) claims.get("exp");
        return LocalDateTime.ofInstant(Instant.ofEpochSecond(exp.longValue()), ZoneId.systemDefault());
    }
}
