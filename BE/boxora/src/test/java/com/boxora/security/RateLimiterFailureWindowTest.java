package com.boxora.security;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

/** The "count only what the caller reports" half of the limiter, used for failed sign-ins. */
class RateLimiterFailureWindowTest {

    private final Duration window = Duration.ofMinutes(15);

    @Test
    @DisplayName("assertBelowLimit không tự đếm: chỉ chặn sau khi đủ số lượt đã ghi nhận")
    void blocksOnlyAfterRecordedHits() {
        RateLimiter limiter = new RateLimiter(true);
        for (int i = 0; i < 20; i++) {
            limiter.assertBelowLimit("login", "a@b.vn", 3, window, null);
        }
        limiter.recordHit("login", "a@b.vn", window);
        limiter.recordHit("login", "a@b.vn", window);
        assertDoesNotThrow(() -> limiter.assertBelowLimit("login", "a@b.vn", 3, window, null));

        limiter.recordHit("login", "a@b.vn", window);
        AppException ex = assertThrows(AppException.class, () -> limiter.assertBelowLimit("login", "a@b.vn", 3, window, null));
        assertEquals(ErrorCode.RATE_LIMIT_EXCEEDED, ex.getErrorCode());
        assertEquals(ErrorCode.RATE_LIMIT_EXCEEDED.getMessage(), ex.getMessage());
    }

    @Test
    @DisplayName("Có thể kèm thông điệp riêng; khóa không phân biệt HOA/thường")
    void customMessageAndCaseInsensitiveKey() {
        RateLimiter limiter = new RateLimiter(true);
        limiter.recordHit("login", "Customer@Gmail.com", window);

        AppException ex = assertThrows(AppException.class,
                () -> limiter.assertBelowLimit("login", " customer@gmail.com", 1, window, "Thử lại sau 15 phút"));

        assertEquals("Thử lại sau 15 phút", ex.getMessage());
        assertEquals(ErrorCode.RATE_LIMIT_EXCEEDED, ex.getErrorCode());
    }

    @Test
    @DisplayName("reset xóa bộ đếm của đúng khóa đó, khóa khác giữ nguyên")
    void resetClearsOnlyThatKey() {
        RateLimiter limiter = new RateLimiter(true);
        limiter.recordHit("login", "a@b.vn", window);
        limiter.recordHit("login", "c@d.vn", window);

        limiter.reset("login", "a@b.vn");

        assertDoesNotThrow(() -> limiter.assertBelowLimit("login", "a@b.vn", 1, window, null));
        assertThrows(AppException.class, () -> limiter.assertBelowLimit("login", "c@d.vn", 1, window, null));
    }

    @Test
    @DisplayName("Cửa sổ trượt: lượt cũ hơn cửa sổ không còn bị tính")
    void oldHitsExpire() throws Exception {
        RateLimiter limiter = new RateLimiter(true);
        Duration tiny = Duration.ofMillis(50);
        limiter.recordHit("login", "a@b.vn", tiny);
        assertThrows(AppException.class, () -> limiter.assertBelowLimit("login", "a@b.vn", 1, tiny, null));

        Thread.sleep(80);

        assertDoesNotThrow(() -> limiter.assertBelowLimit("login", "a@b.vn", 1, tiny, null));
    }

    @Test
    @DisplayName("Tắt bộ giới hạn thì không chặn gì")
    void disabledLimiterNeverBlocks() {
        RateLimiter limiter = new RateLimiter(false);
        for (int i = 0; i < 100; i++) {
            limiter.recordHit("login", "a@b.vn", window);
        }
        assertDoesNotThrow(() -> limiter.assertBelowLimit("login", "a@b.vn", 1, window, null));
    }

    @Test
    @DisplayName("Khóa trống không bao giờ bị đếm hay chặn")
    void blankKeysAreIgnored() {
        RateLimiter limiter = new RateLimiter(true);
        limiter.recordHit("login", null, window);
        limiter.recordHit("login", "  ", window);
        limiter.reset("login", null);
        assertDoesNotThrow(() -> limiter.assertBelowLimit("login", null, 1, window, null));
        assertDoesNotThrow(() -> limiter.assertBelowLimit("login", "", 1, window, null));
    }
}
