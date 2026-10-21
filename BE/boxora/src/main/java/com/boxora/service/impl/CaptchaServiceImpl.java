package com.boxora.service.impl;

import com.boxora.dto.response.CaptchaResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.service.CaptchaService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class CaptchaServiceImpl implements CaptchaService {

    private static final String CHAR_POOL = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final int CODE_LENGTH = 5;
    private static final long EXPIRE_SECONDS = 300; // 5 minutes
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String REDIS_KEY_PREFIX = "boxora:captcha:";

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${app.redis.enabled:true}")
    private boolean redisEnabled;

    public CaptchaServiceImpl(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    private static class CaptchaEntry {
        final String code;
        final Instant expiresAt;

        CaptchaEntry(String code, Instant expiresAt) {
            this.code = code;
            this.expiresAt = expiresAt;
        }
    }

    /** Fallback store used when Redis is disabled or unreachable (single instance only). */
    private final Map<String, CaptchaEntry> captchaStore = new ConcurrentHashMap<>();

    @Override
    public CaptchaResponse generateCaptcha() {
        cleanupExpired();

        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CHAR_POOL.charAt(RANDOM.nextInt(CHAR_POOL.length())));
        }
        String code = sb.toString();
        String captchaId = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plusSeconds(EXPIRE_SECONDS);

        storeCode(captchaId, code, expiresAt);

        String svg = generateCaptchaSvg(code);
        String base64Svg = "data:image/svg+xml;base64," + Base64.getEncoder().encodeToString(svg.getBytes(StandardCharsets.UTF_8));

        return CaptchaResponse.builder()
                .captchaId(captchaId)
                .captchaImage(base64Svg)
                .build();
    }

    @Override
    public void validate(String captchaId, String inputCode) {
        // No bypass codes: a captcha is only accepted when it was issued by this service, is unexpired,
        // matches the typed code, and it is single use (consumed even when the guess is wrong).
        if (captchaId == null || captchaId.trim().isEmpty() || inputCode == null || inputCode.trim().isEmpty()) {
            throw new AppException(ErrorCode.CAPTCHA_REQUIRED);
        }

        String expectedCode = consumeCode(captchaId.trim());
        if (expectedCode == null) {
            throw new AppException(ErrorCode.INVALID_CAPTCHA);
        }

        if (!expectedCode.equalsIgnoreCase(inputCode.trim())) {
            throw new AppException(ErrorCode.INVALID_CAPTCHA);
        }
    }

    private void storeCode(String captchaId, String code, Instant expiresAt) {
        if (redisAvailable()) {
            try {
                redisTemplate.opsForValue().set(REDIS_KEY_PREFIX + captchaId, code, Duration.ofSeconds(EXPIRE_SECONDS));
                return;
            } catch (Exception e) {
                log.warn("[CAPTCHA] Redis unavailable, using the in-memory captcha store: {}", e.getMessage());
            }
        }
        captchaStore.put(captchaId, new CaptchaEntry(code, expiresAt));
    }

    /** Returns the stored code (and removes it), or null when unknown / expired. */
    private String consumeCode(String captchaId) {
        if (redisAvailable()) {
            try {
                Object value = redisTemplate.opsForValue().getAndDelete(REDIS_KEY_PREFIX + captchaId);
                if (value != null) {
                    return String.valueOf(value);
                }
            } catch (Exception e) {
                log.warn("[CAPTCHA] Redis unavailable while validating, checking the in-memory store: {}", e.getMessage());
            }
        }
        CaptchaEntry entry = captchaStore.remove(captchaId);
        if (entry == null || Instant.now().isAfter(entry.expiresAt)) {
            return null;
        }
        return entry.code;
    }

    private boolean redisAvailable() {
        return redisEnabled && redisTemplate != null;
    }

    private void cleanupExpired() {
        Instant now = Instant.now();
        captchaStore.entrySet().removeIf(entry -> now.isAfter(entry.getValue().expiresAt));
    }

    private String generateCaptchaSvg(String code) {
        int width = 160;
        int height = 50;

        StringBuilder svg = new StringBuilder();
        svg.append(String.format("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"%d\" height=\"%d\" viewBox=\"0 0 %d %d\">", width, height, width, height));
        svg.append("<defs>");
        svg.append("<linearGradient id=\"bg\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">");
        svg.append("<stop offset=\"0%\" stop-color=\"#f8fafc\" />");
        svg.append("<stop offset=\"100%\" stop-color=\"#f1f5f9\" />");
        svg.append("</linearGradient>");
        svg.append("</defs>");
        svg.append(String.format("<rect width=\"%d\" height=\"%d\" rx=\"8\" fill=\"url(#bg)\" stroke=\"#cbd5e1\" stroke-width=\"1\"/>", width, height));

        // Noise lines
        for (int i = 0; i < 4; i++) {
            int x1 = RANDOM.nextInt(20);
            int y1 = RANDOM.nextInt(height);
            int x2 = width - RANDOM.nextInt(20);
            int y2 = RANDOM.nextInt(height);
            int cx1 = RANDOM.nextInt(width);
            int cy1 = RANDOM.nextInt(height);
            String[] strokeColors = {"#fdba74", "#94a3b8", "#f97316", "#64748b"};
            String color = strokeColors[i % strokeColors.length];
            svg.append(String.format("<path d=\"M %d %d Q %d %d %d %d\" stroke=\"%s\" stroke-width=\"1.5\" fill=\"none\" opacity=\"0.55\" />",
                    x1, y1, cx1, cy1, x2, y2, color));
        }

        // Noise dots
        for (int i = 0; i < 24; i++) {
            int cx = RANDOM.nextInt(width);
            int cy = RANDOM.nextInt(height);
            int r = RANDOM.nextInt(2) + 1;
            svg.append(String.format("<circle cx=\"%d\" cy=\"%d\" r=\"%d\" fill=\"#94a3b8\" opacity=\"0.4\" />", cx, cy, r));
        }

        // Render characters
        int startX = 18;
        int stepX = 26;
        String[] fontColors = {"#ea580c", "#0f172a", "#c2410c", "#334155", "#b45309"};

        for (int i = 0; i < code.length(); i++) {
            char ch = code.charAt(i);
            int x = startX + (i * stepX) + RANDOM.nextInt(6) - 3;
            int y = 33 + RANDOM.nextInt(6) - 3;
            int rot = RANDOM.nextInt(30) - 15;
            String color = fontColors[i % fontColors.length];

            svg.append(String.format("<text x=\"%d\" y=\"%d\" font-family=\"monospace, sans-serif\" font-size=\"24\" font-weight=\"bold\" fill=\"%s\" transform=\"rotate(%d, %d, %d)\">%c</text>",
                    x, y, color, rot, x, y, ch));
        }

        svg.append("</svg>");
        return svg.toString();
    }
}
