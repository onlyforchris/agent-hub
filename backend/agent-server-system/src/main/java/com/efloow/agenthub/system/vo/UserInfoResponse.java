package com.efloow.agenthub.system.vo;

import java.util.List;

public record UserInfoResponse(
        String userId,
        String username,
        String nickname,
        String departmentId,
        String email,
        String phone,
        String dataScope,
        List<String> permissions,
        List<String> menuIds,
        List<String> agentIds
) {
}
