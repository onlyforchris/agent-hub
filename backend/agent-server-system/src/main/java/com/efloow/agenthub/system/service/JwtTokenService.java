package com.efloow.agenthub.system.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;
    private final byte[] secret;
    private final long expiresInSeconds;
    private final long refreshExpiresInSeconds;

    public JwtTokenService(
            ObjectMapper objectMapper,
            @Value("${agent.auth.jwt.secret}") String secret,
            @Value("${agent.auth.jwt.expires-in-seconds:7200}") long expiresInSeconds,
            @Value("${agent.auth.jwt.refresh-expires-in-seconds:604800}") long refreshExpiresInSeconds
    ) {
        this.objectMapper = objectMapper;
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.expiresInSeconds = expiresInSeconds;
        this.refreshExpiresInSeconds = refreshExpiresInSeconds;
    }

    public String createToken(String userId, String username, String nickname) {
        return createAccessToken(userId, username, nickname);
    }

    public String createAccessToken(String userId, String username, String nickname) {
        return createToken(userId, username, nickname, "ACCESS", expiresInSeconds);
    }

    public String createRefreshToken(String userId, String username, String nickname) {
        return createToken(userId, username, nickname, "REFRESH", refreshExpiresInSeconds);
    }

    private String createToken(String userId, String username, String nickname, String tokenType, long ttlSeconds) {
        long now = Instant.now().getEpochSecond();
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("jti", UUID.randomUUID().toString());
        payload.put("sub", userId);
        payload.put("userId", userId);
        payload.put("username", username);
        payload.put("nickname", nickname);
        payload.put("tokenType", tokenType);
        payload.put("iat", now);
        payload.put("exp", now + ttlSeconds);
        String unsigned = encodeJson(header) + "." + encodeJson(payload);
        return unsigned + "." + sign(unsigned);
    }

    public Map<String, Object> verify(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return Map.of();
            }
            String unsigned = parts[0] + "." + parts[1];
            if (!constantTimeEquals(sign(unsigned), parts[2])) {
                return Map.of();
            }
            Map<String, Object> payload = objectMapper.readValue(DECODER.decode(parts[1]), new TypeReference<>() {
            });
            Number exp = (Number) payload.get("exp");
            if (exp == null || exp.longValue() <= Instant.now().getEpochSecond()) {
                return Map.of();
            }
            return payload;
        } catch (Exception ex) {
            return Map.of();
        }
    }

    public Map<String, Object> verifyAccessToken(String token) {
        return verifyTokenType(token, "ACCESS");
    }

    public Map<String, Object> verifyRefreshToken(String token) {
        return verifyTokenType(token, "REFRESH");
    }

    public long getExpiresInSeconds() {
        return expiresInSeconds;
    }

    public long getRefreshExpiresInSeconds() {
        return refreshExpiresInSeconds;
    }

    private Map<String, Object> verifyTokenType(String token, String tokenType) {
        Map<String, Object> claims = verify(token);
        if (!tokenType.equals(claims.get("tokenType"))) {
            return Map.of();
        }
        return claims;
    }

    private String encodeJson(Map<String, Object> value) {
        try {
            return ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to encode JWT", ex);
        }
    }

    private String sign(String content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return ENCODER.encodeToString(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to sign JWT", ex);
        }
    }

    private boolean constantTimeEquals(String left, String right) {
        if (left.length() != right.length()) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < left.length(); i++) {
            result |= left.charAt(i) ^ right.charAt(i);
        }
        return result == 0;
    }
}
