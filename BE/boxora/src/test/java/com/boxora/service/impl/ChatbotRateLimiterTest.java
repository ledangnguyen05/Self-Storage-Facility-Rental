package com.boxora.service.impl;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatbotRateLimiterTest {

    private final AtomicLong now = new AtomicLong(1_000_000L);

    private ChatbotRateLimiter limiter(int perMinute, int perHour, int globalPerMinute) {
        return new ChatbotRateLimiter(perMinute, perHour, globalPerMinute, now::get);
    }

    private static void assertLimited(Runnable call) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(AppException.class, e -> org.assertj.core.api.Assertions.assertThat(e.getErrorCode())
                        .isEqualTo(ErrorCode.CHATBOT_RATE_LIMITED));
    }

    @Test
    @DisplayName("A caller can ask perMinute questions per minute, then has to wait")
    void blocksAfterPerMinuteLimit() {
        ChatbotRateLimiter limiter = limiter(3, 100, 100);
        for (int i = 0; i < 3; i++) {
            limiter.acquire("ip:1.1.1.1");
        }
        assertLimited(() -> limiter.acquire("ip:1.1.1.1"));

        now.addAndGet(61_000);
        assertThatCode(() -> limiter.acquire("ip:1.1.1.1")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Callers are limited independently")
    void callersAreIndependent() {
        ChatbotRateLimiter limiter = limiter(1, 100, 100);
        limiter.acquire("ip:1.1.1.1");
        assertLimited(() -> limiter.acquire("ip:1.1.1.1"));
        assertThatCode(() -> limiter.acquire("ip:2.2.2.2")).doesNotThrowAnyException();
        assertThatCode(() -> limiter.acquire("user:a@example.com")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("The hourly cap holds even when the per-minute cap is respected")
    void blocksAfterPerHourLimit() {
        ChatbotRateLimiter limiter = limiter(2, 4, 100);
        for (int i = 0; i < 4; i++) {
            limiter.acquire("ip:1.1.1.1");
            now.addAndGet(31_000); // two calls per minute at most
        }
        assertLimited(() -> limiter.acquire("ip:1.1.1.1"));

        now.addAndGet(3_600_000);
        assertThatCode(() -> limiter.acquire("ip:1.1.1.1")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("One server-wide cap protects the Gemini quota from many different callers")
    void globalCapAppliesToEveryone() {
        ChatbotRateLimiter limiter = limiter(5, 50, 3);
        limiter.acquire("ip:1");
        limiter.acquire("ip:2");
        limiter.acquire("ip:3");
        assertLimited(() -> limiter.acquire("ip:4"));

        now.addAndGet(61_000);
        assertThatCode(() -> limiter.acquire("ip:4")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Rejected calls are not recorded, so a blocked caller is free again exactly one window later")
    void rejectedCallsDoNotExtendTheBlock() {
        ChatbotRateLimiter limiter = limiter(1, 100, 100);
        limiter.acquire("ip:1");
        for (int i = 0; i < 20; i++) {
            now.addAndGet(1_000);
            assertLimited(() -> limiter.acquire("ip:1"));
        }
        now.addAndGet(41_000); // 61 s after the only accepted call
        assertThatCode(() -> limiter.acquire("ip:1")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("A missing caller key is treated as one anonymous caller, not as unlimited")
    void missingKeyIsLimited() {
        ChatbotRateLimiter limiter = limiter(1, 100, 100);
        limiter.acquire(null);
        assertLimited(() -> limiter.acquire(" "));
    }
}
