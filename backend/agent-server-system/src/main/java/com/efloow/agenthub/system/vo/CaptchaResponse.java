package com.efloow.agenthub.system.vo;

public record CaptchaResponse(String captchaId, String imageBase64, long expiresIn) {
}
