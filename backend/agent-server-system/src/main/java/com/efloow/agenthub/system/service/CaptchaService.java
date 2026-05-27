package com.efloow.agenthub.system.service;

import com.efloow.agenthub.common.exception.BusinessException;
import com.efloow.agenthub.system.vo.CaptchaResponse;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CaptchaService {

    private static final char[] CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();

    private final SecureRandom random = new SecureRandom();
    private final Map<String, CaptchaEntry> captchaStore = new ConcurrentHashMap<>();
    private final long expiresInSeconds;

    public CaptchaService(@Value("${agent.auth.captcha.expires-in-seconds:300}") long expiresInSeconds) {
        this.expiresInSeconds = expiresInSeconds;
    }

    public CaptchaResponse createCaptcha() {
        String captchaId = UUID.randomUUID().toString();
        String code = randomCode();
        captchaStore.put(captchaId, new CaptchaEntry(code, Instant.now().plusSeconds(expiresInSeconds)));
        return new CaptchaResponse(captchaId, renderBase64(code), expiresInSeconds);
    }

    public void verify(String captchaId, String captchaCode) {
        CaptchaEntry entry = captchaStore.remove(captchaId);
        if (entry == null || entry.expiresAt().isBefore(Instant.now())) {
            throw new BusinessException("A001_CAPTCHA_EXPIRED", "验证码已过期");
        }
        if (!entry.code().equalsIgnoreCase(captchaCode.trim())) {
            throw new BusinessException("A002_CAPTCHA_INVALID", "验证码错误");
        }
    }

    private String randomCode() {
        StringBuilder code = new StringBuilder(4);
        for (int i = 0; i < 4; i++) {
            code.append(CHARS[random.nextInt(CHARS.length)]);
        }
        return code.toString();
    }

    private String renderBase64(String code) {
        try {
            int width = 118;
            int height = 40;
            BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = image.createGraphics();
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.setColor(new Color(246, 248, 252));
            graphics.fillRect(0, 0, width, height);
            for (int i = 0; i < 8; i++) {
                graphics.setColor(new Color(150 + random.nextInt(80), 150 + random.nextInt(80), 150 + random.nextInt(80)));
                graphics.drawLine(random.nextInt(width), random.nextInt(height), random.nextInt(width), random.nextInt(height));
            }
            graphics.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 25));
            for (int i = 0; i < code.length(); i++) {
                graphics.setColor(new Color(30 + random.nextInt(80), 60 + random.nextInt(80), 90 + random.nextInt(80)));
                graphics.rotate(Math.toRadians(random.nextInt(21) - 10), 22 + i * 24, 24);
                graphics.drawString(code.substring(i, i + 1).toUpperCase(Locale.ROOT), 14 + i * 24, 28);
                graphics.rotate(Math.toRadians(10 - random.nextInt(21)), 22 + i * 24, 24);
            }
            graphics.setStroke(new BasicStroke(1.2f));
            graphics.setColor(new Color(200, 209, 224));
            graphics.drawRect(0, 0, width - 1, height - 1);
            graphics.dispose();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "png", out);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (Exception ex) {
            throw new BusinessException("A003_CAPTCHA_RENDER_FAILED", "验证码生成失败");
        }
    }

    private record CaptchaEntry(String code, Instant expiresAt) {
    }
}
