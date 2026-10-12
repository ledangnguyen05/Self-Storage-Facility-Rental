package com.boxora.service.impl;

import com.boxora.service.StorageUnitLockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class StorageUnitLockServiceImpl implements StorageUnitLockService {

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${app.redis.enabled:true}")
    private boolean redisEnabled;

    @Value("${app.booking.soft-lock-hours:24}")
    private long defaultSoftLockHours;

    private static final String LOCK_KEY_PREFIX = "boxora:lock:storage_unit:";

    // Fallback In-Memory Lock khi Redis server offline hoặc chưa khởi động
    private final Map<UUID, InMemLockEntry> inMemoryLocks = new ConcurrentHashMap<>();

    private record InMemLockEntry(UUID bookingId, LocalDateTime expiresAt) {
        boolean isExpired() {
            return LocalDateTime.now().isAfter(expiresAt);
        }
    }

    @Override
    public boolean tryLockUnit(UUID unitId, UUID bookingId, long timeoutHours) {
        if (unitId == null) {
            return false;
        }

        long hours = timeoutHours > 0 ? timeoutHours : defaultSoftLockHours;
        String lockKey = LOCK_KEY_PREFIX + unitId;
        String lockValue = bookingId != null ? bookingId.toString() : "PENDING_RESERVATION";

        if (redisEnabled) {
            try {
                Boolean acquired = redisTemplate.opsForValue()
                        .setIfAbsent(lockKey, lockValue, Duration.ofHours(hours));

                if (Boolean.TRUE.equals(acquired)) {
                    log.info("[REDIS_LOCK] Successfully acquired 24h soft-lock for storage unit {} by booking {} (TTL: {}h)",
                            unitId, lockValue, hours);
                    return true;
                } else {
                    log.warn("[REDIS_LOCK] Storage unit {} is already soft-locked by another booking", unitId);
                    return false;
                }
            } catch (Exception e) {
                log.warn("[REDIS_FALLBACK] Redis error when acquiring soft-lock for unit {}: {}. Falling back to in-memory lock.",
                        unitId, e.getMessage());
            }
        }

        // Fallback: In-Memory Soft-Lock
        return inMemoryLocks.compute(unitId, (k, existing) -> {
            if (existing != null && !existing.isExpired()) {
                log.warn("[IN_MEMORY_LOCK] Storage unit {} is already locked until {}", unitId, existing.expiresAt());
                return existing; // Giữ nguyên lock cũ, không cho lock mới
            }
            log.info("[IN_MEMORY_LOCK] Acquired in-memory soft-lock for unit {} (TTL: {}h)", unitId, hours);
            return new InMemLockEntry(bookingId, LocalDateTime.now().plusHours(hours));
        }).bookingId().equals(bookingId);
    }

    @Override
    public boolean isUnitLocked(UUID unitId) {
        if (unitId == null) {
            return false;
        }

        String lockKey = LOCK_KEY_PREFIX + unitId;

        if (redisEnabled) {
            try {
                Boolean hasKey = redisTemplate.hasKey(lockKey);
                if (Boolean.TRUE.equals(hasKey)) {
                    return true;
                }
            } catch (Exception e) {
                log.warn("[REDIS_FALLBACK] Redis error checking lock for unit {}: {}. Checking in-memory fallback.",
                        unitId, e.getMessage());
            }
        }

        // Kiểm tra In-Memory Fallback
        InMemLockEntry entry = inMemoryLocks.get(unitId);
        if (entry != null) {
            if (entry.isExpired()) {
                inMemoryLocks.remove(unitId);
                return false;
            }
            return true;
        }

        return false;
    }

    @Override
    public void releaseLock(UUID unitId) {
        if (unitId == null) {
            return;
        }

        String lockKey = LOCK_KEY_PREFIX + unitId;

        if (redisEnabled) {
            try {
                Boolean deleted = redisTemplate.delete(lockKey);
                log.info("[REDIS_LOCK] Released soft-lock for storage unit {}: {}", unitId, deleted);
            } catch (Exception e) {
                log.warn("[REDIS_FALLBACK] Redis error releasing lock for unit {}: {}", unitId, e.getMessage());
            }
        }

        inMemoryLocks.remove(unitId);
        log.info("[LOCK_RELEASE] In-memory soft-lock cleared for storage unit {}", unitId);
    }

    @Override
    public String getLockHolder(UUID unitId) {
        if (unitId == null) {
            return null;
        }

        String lockKey = LOCK_KEY_PREFIX + unitId;

        if (redisEnabled) {
            try {
                Object val = redisTemplate.opsForValue().get(lockKey);
                if (val != null) {
                    return val.toString();
                }
            } catch (Exception e) {
                log.warn("[REDIS_FALLBACK] Redis error getting lock holder for unit {}: {}", unitId, e.getMessage());
            }
        }

        InMemLockEntry entry = inMemoryLocks.get(unitId);
        if (entry != null && !entry.isExpired()) {
            return entry.bookingId() != null ? entry.bookingId().toString() : "IN_MEMORY_HELD";
        }

        return null;
    }
}

