package com.efloow.agenthub.common.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES 加解密工具。GCM 模式（12 字节随机 IV 前置），解密兼容旧 ECB 密文。
 */
public final class AesUtil {

    private static final String GCM = "AES/GCM/NoPadding";
    private static final String ECB = "AES/ECB/PKCS5Padding";
    private static final int GCM_IV_LEN = 12;
    private static final int GCM_TAG_LEN = 128;

    private AesUtil() {
    }

    public static String encrypt(String plainText, String secret) {
        if (plainText == null || plainText.isEmpty()) {
            return "";
        }
        try {
            SecretKeySpec keySpec = keySpec(secret);
            byte[] iv = new byte[GCM_IV_LEN];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance(GCM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LEN, iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[GCM_IV_LEN + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, GCM_IV_LEN);
            System.arraycopy(encrypted, 0, combined, GCM_IV_LEN, encrypted.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("AES encrypt failed", e);
        }
    }

    public static String decrypt(String cipherText, String secret) {
        if (cipherText == null || cipherText.isEmpty()) {
            return "";
        }
        byte[] raw = Base64.getDecoder().decode(cipherText);
        // GCM output for non-empty plaintext is always >= IV(12) + tag(16) = 28 bytes
        if (raw.length >= GCM_IV_LEN + 16) {
            try {
                byte[] iv = new byte[GCM_IV_LEN];
                System.arraycopy(raw, 0, iv, 0, GCM_IV_LEN);
                byte[] encrypted = new byte[raw.length - GCM_IV_LEN];
                System.arraycopy(raw, GCM_IV_LEN, encrypted, 0, encrypted.length);
                Cipher cipher = Cipher.getInstance(GCM);
                cipher.init(Cipher.DECRYPT_MODE, keySpec(secret), new GCMParameterSpec(GCM_TAG_LEN, iv));
                return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
            } catch (Exception ignored) {
                // not valid GCM ciphertext, fall through to ECB
            }
        }
        // Legacy ECB fallback
        try {
            Cipher cipher = Cipher.getInstance(ECB);
            cipher.init(Cipher.DECRYPT_MODE, keySpec(secret));
            return new String(cipher.doFinal(raw), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("AES decrypt failed", e);
        }
    }

    private static SecretKeySpec keySpec(String secret) {
        byte[] keyBytes = new byte[16];
        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        System.arraycopy(secretBytes, 0, keyBytes, 0, Math.min(secretBytes.length, 16));
        return new SecretKeySpec(keyBytes, "AES");
    }
}
