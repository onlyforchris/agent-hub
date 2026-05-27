package com.efloow.agenthub.system.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshTokenRequest(
        @NotBlank(message = "refreshToken不能为空")
        String refreshToken
) {
}
