package com.boxora.service.impl;

import com.boxora.dto.response.CaptchaResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class CaptchaServiceImplTest {

    private CaptchaServiceImpl captchaService;

    @BeforeEach
    void setUp() {
        // No Redis: the in-memory store is used.
        captchaService = new CaptchaServiceImpl(null);
        ReflectionTestUtils.setField(captchaService, "redisEnabled", false);
    }

    /** The captcha image is an SVG with one <text> element per character; read the answer back from it. */
    private static String solve(CaptchaResponse captcha) {
        String base64 = captcha.getCaptchaImage().substring(captcha.getCaptchaImage().indexOf(',') + 1);
        String svg = new String(Base64.getDecoder().decode(base64), StandardCharsets.UTF_8);
        Matcher matcher = Pattern.compile("<text[^>]*>([^<])</text>").matcher(svg);
        StringBuilder answer = new StringBuilder();
        while (matcher.find()) {
            answer.append(matcher.group(1));
        }
        return answer.toString();
    }

    @Test
    @DisplayName("Mã bypass 99999 / BOXORA không còn được chấp nhận")
    void bypassCodesAreRejected() {
        CaptchaResponse captcha = captchaService.generateCaptcha();

        assertEquals(ErrorCode.INVALID_CAPTCHA,
                assertThrows(AppException.class, () -> captchaService.validate(captcha.getCaptchaId(), "99999")).getErrorCode());
        // validate() consumed the captcha, so even a fresh wrong guess cannot be retried against it
        CaptchaResponse another = captchaService.generateCaptcha();
        assertEquals(ErrorCode.INVALID_CAPTCHA,
                assertThrows(AppException.class, () -> captchaService.validate(another.getCaptchaId(), "BOXORA")).getErrorCode());
    }

    @Test
    @DisplayName("Mã bypass với captchaId rỗng/giả cũng bị từ chối")
    void bypassCodesWithoutValidCaptchaIdAreRejected() {
        assertEquals(ErrorCode.CAPTCHA_REQUIRED,
                assertThrows(AppException.class, () -> captchaService.validate(null, "99999")).getErrorCode());
        assertEquals(ErrorCode.CAPTCHA_REQUIRED,
                assertThrows(AppException.class, () -> captchaService.validate("", "BOXORA")).getErrorCode());
        assertEquals(ErrorCode.INVALID_CAPTCHA,
                assertThrows(AppException.class, () -> captchaService.validate("not-issued-by-us", "99999")).getErrorCode());
        assertEquals(ErrorCode.INVALID_CAPTCHA,
                assertThrows(AppException.class, () -> captchaService.validate("not-issued-by-us", "BOXORA")).getErrorCode());
    }

    @Test
    @DisplayName("Mã đúng được chấp nhận một lần (không phân biệt hoa thường), dùng lại bị từ chối")
    void correctAnswerWorksOnce() {
        CaptchaResponse captcha = captchaService.generateCaptcha();
        String answer = solve(captcha);
        assertEquals(5, answer.length());

        assertDoesNotThrow(() -> captchaService.validate(captcha.getCaptchaId(), answer.toLowerCase()));
        assertEquals(ErrorCode.INVALID_CAPTCHA,
                assertThrows(AppException.class, () -> captchaService.validate(captcha.getCaptchaId(), answer)).getErrorCode());
    }

    @Test
    @DisplayName("Đoán sai làm mất hiệu lực captcha (không thể thử lại nhiều lần)")
    void wrongGuessConsumesCaptcha() {
        CaptchaResponse captcha = captchaService.generateCaptcha();
        String answer = solve(captcha);

        assertThrows(AppException.class, () -> captchaService.validate(captcha.getCaptchaId(), "WRONG"));
        assertEquals(ErrorCode.INVALID_CAPTCHA,
                assertThrows(AppException.class, () -> captchaService.validate(captcha.getCaptchaId(), answer)).getErrorCode());
    }
}
