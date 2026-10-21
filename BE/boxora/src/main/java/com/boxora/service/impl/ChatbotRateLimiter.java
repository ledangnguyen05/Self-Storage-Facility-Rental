package com.boxora.service.impl;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.function.LongSupplier;

/**
 * Sliding-window limits for the public chatbot endpoint, which would otherwise let anyone spend the Gemini
 * quota: a per-caller limit per minute and per hour, plus one cap for the whole server per minute.
 * Rejected calls are not recorded, so a blocked caller is never locked out longer than the window.
 * State is in memory (one server instance).
 */
@Component
public class ChatbotRateLimiter {

    private static final long MINUTE_MS = Duration.ofMinutes(1).toMillis();
    private static final long HOUR_MS = Duration.ofHours(1).toMillis();

    private final int perMinute;
    private final int perHour;
    private final int globalPerMinute;
    private final LongSupplier clock;

    private final Map<String, Deque<Long>> hitsByCaller = new HashMap<>();
    private final Deque<Long> globalHits = new ArrayDeque<>();
    private long lastSweep;

    @Autowired
    public ChatbotRateLimiter(
            @Value("${chatbot.rate-limit.per-minute:8}") int perMinute,
            @Value("${chatbot.rate-limit.per-hour:60}") int perHour,
            @Value("${chatbot.rate-limit.global-per-minute:90}") int globalPerMinute
    ) {
        this(perMinute, perHour, globalPerMinute, System::currentTimeMillis);
    }

    ChatbotRateLimiter(int perMinute, int perHour, int globalPerMinute, LongSupplier clock) {
        this.perMinute = Math.max(1, perMinute);
        this.perHour = Math.max(this.perMinute, perHour);
        this.globalPerMinute = Math.max(1, globalPerMinute);
        this.clock = clock;
    }

    /**
     * Records one call for {@code callerKey}.
     *
     * @throws AppException CHATBOT_RATE_LIMITED when the caller or the whole server is over its limit
     */
    public synchronized void acquire(String callerKey) {
        long now = clock.getAsLong();
        sweepIfDue(now);

        prune(globalHits, now - MINUTE_MS);
        if (globalHits.size() >= globalPerMinute) {
            throw new AppException(ErrorCode.CHATBOT_RATE_LIMITED);
        }

        String key = callerKey == null || callerKey.isBlank() ? "unknown" : callerKey;
        Deque<Long> hits = hitsByCaller.computeIfAbsent(key, k -> new ArrayDeque<>());
        prune(hits, now - HOUR_MS);
        if (hits.size() >= perHour || countSince(hits, now - MINUTE_MS) >= perMinute) {
            throw new AppException(ErrorCode.CHATBOT_RATE_LIMITED);
        }

        hits.addLast(now);
        globalHits.addLast(now);
    }

    private static void prune(Deque<Long> hits, long oldestAllowed) {
        while (!hits.isEmpty() && hits.peekFirst() <= oldestAllowed) {
            hits.pollFirst();
        }
    }

    private static int countSince(Deque<Long> hits, long since) {
        int count = 0;
        Iterator<Long> descending = hits.descendingIterator();
        while (descending.hasNext() && descending.next() > since) {
            count++;
        }
        return count;
    }

    /** Drops callers that have been quiet for an hour so the map cannot grow without bound. */
    private void sweepIfDue(long now) {
        if (now - lastSweep < MINUTE_MS) {
            return;
        }
        lastSweep = now;
        hitsByCaller.values().removeIf(hits -> {
            prune(hits, now - HOUR_MS);
            return hits.isEmpty();
        });
    }
}
