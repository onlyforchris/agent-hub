package com.efloow.agenthub.system.vo;

import java.util.List;

public record LoginResponse(
        String token,
        String refreshToken,
        long expiresIn,
        String userId,
        String username,
        String nickname,
        String dataScope,
        List<String> permissions,
        List<String> menuIds,
        List<String> agentIds
) {
}
