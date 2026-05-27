package com.efloow.agenthub.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenServiceTest {

    @Test
    void accessAndRefreshTokensRequireMatchingTokenType() {
        JwtTokenService service = new JwtTokenService(new ObjectMapper(), "test-secret", 60, 3600);

        String accessToken = service.createAccessToken("u1", "admin", "Admin");
        String refreshToken = service.createRefreshToken("u1", "admin", "Admin");

        Map<String, Object> accessClaims = service.verifyAccessToken(accessToken);
        Map<String, Object> refreshClaims = service.verifyRefreshToken(refreshToken);

        assertThat(accessClaims).containsEntry("tokenType", "ACCESS");
        assertThat(refreshClaims).containsEntry("tokenType", "REFRESH");
        assertThat(service.verifyRefreshToken(accessToken)).isEmpty();
        assertThat(service.verifyAccessToken(refreshToken)).isEmpty();
    }
}
