package com.efloow.agenthub.system.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password,
        @NotBlank String captchaId,
        @NotBlank String captchaCode
) {
}
