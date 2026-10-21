package com.boxora.security;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Small in-memory sliding-window limiter for anonymous, abuse-prone endpoints (login, register, forgot-password).
 * Per instance only: it slows down floods and mailbox bombing; it is not a replacement for a gateway limiter.
 *
 * <p>Two styles are offered: {@link #check} counts every call (register, forgot-password), while
 * {@link #assertBelowLimit} + {@link #recordHit} + {@link #reset} count only the calls the caller reports
 * (failed logins), so a user who types the right password is never throttled by his own earlier success.
 */
@Component
public class RateLimiter {

    /** Above this many tracked keys we sweep expired windows so the map cannot grow without bound. */
    private static final int SWEEP_THRESHOLD = 10_000;
    /** Windows used by callers are far shorter than this, so older entries can always be dropped. */
    private static final long MAX_TRACKED_AGE_MS = Duration.ofHours(24).toMillis();

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    @Value("${app.security.rate-limit.enabled:true}")
    private boolean enabled = true;

    public RateLimiter() {
    }

    /** Test / manual construction. */
    public RateLimiter(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * Records one attempt for {@code bucket:key} and throws RATE_LIMIT_EXCEEDED when more than
     * {@code maxAttempts} happened within {@code window}.
     */
    public void check(String bucket, String key, int maxAttempts, Duration window) {
        if (!enabled || key == null || key.isBlank() || maxAttempts <= 0) {
            return;
        }
        long now = System.currentTimeMillis();
        long windowMs = window.toMillis();
        sweepIfLarge(now);

        Deque<Long> deque = hits.computeIfAbsent(keyOf(bucket, key), k -> new ArrayDeque<>());
        boolean allowed;
        synchronized (deque) {
            prune(deque, now, windowMs);
            allowed = deque.size() < maxAttempts;
            if (allowed) {
                deque.addLast(now);
            }
        }
        if (!allowed) {
            throw new AppException(ErrorCode.RATE_LIMIT_EXCEEDED);
        }
    }

    /**
     * Throws RATE_LIMIT_EXCEEDED (with {@code message} when given) once {@code maxHits} hits were recorded for
     * {@code bucket:key} within {@code window}. Does not count this call itself.
     */
    public void assertBelowLimit(String bucket, String key, int maxHits, Duration window, String message) {
        if (!enabled || key == null || key.isBlank() || maxHits <= 0) {
            return;
        }
        Deque<Long> deque = hits.get(keyOf(bucket, key));
        if (deque == null) {
            return;
        }
        boolean blocked;
        synchronized (deque) {
            prune(deque, System.currentTimeMillis(), window.toMillis());
            blocked = deque.size() >= maxHits;
        }
        if (blocked) {
            throw message == null
                    ? new AppException(ErrorCode.RATE_LIMIT_EXCEEDED)
                    : new AppException(ErrorCode.RATE_LIMIT_EXCEEDED, message);
        }
    }

    /** Counts one hit for {@code bucket:key} (e.g. one failed login). */
    public void recordHit(String bucket, String key, Duration window) {
        if (!enabled || key == null || key.isBlank()) {
            return;
        }
        long now = System.currentTimeMillis();
        sweepIfLarge(now);
        Deque<Long> deque = hits.computeIfAbsent(keyOf(bucket, key), k -> new ArrayDeque<>());
        synchronized (deque) {
            prune(deque, now, window.toMillis());
            deque.addLast(now);
        }
    }

    /** Forgets every hit of {@code bucket:key} (e.g. after the right password was typed). */
    public void reset(String bucket, String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        hits.remove(keyOf(bucket, key));
    }

    private static String keyOf(String bucket, String key) {
        return bucket + ':' + key.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private static void prune(Deque<Long> deque, long now, long windowMs) {
        while (!deque.isEmpty() && now - deque.peekFirst() > windowMs) {
            deque.pollFirst();
        }
    }

    private void sweepIfLarge(long now) {
        if (hits.size() > SWEEP_THRESHOLD) {
            sweep(now, MAX_TRACKED_AGE_MS);
        }
    }

    private void sweep(long now, long windowMs) {
        hits.entrySet().removeIf(entry -> {
            Deque<Long> deque = entry.getValue();
            synchronized (deque) {
                Long last = deque.peekLast();
                return last == null || now - last > windowMs;
            }
        });
    }
}
