package com.boxora.controller;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/v1/shared-state")
@RequiredArgsConstructor
@Slf4j
public class SharedClientStateController {

    private static final String INSTANCE_ID_KEY = "__server_instance_id__";
    private static final String REVISION_KEY = "__state_revision_ts__";
    private static final String SSE_PADDING = " ".repeat(2048);
    private final JdbcTemplate jdbcTemplate;
    private volatile String serverInstanceId = UUID.randomUUID().toString();
    private final AtomicLong lastMutationAt = new AtomicLong(0L);
    private final CopyOnWriteArrayList<SseEmitter> sseEmitters = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "boxora-sse-heartbeat");
        t.setDaemon(true);
        return t;
    });

    @PostConstruct
    public void initTable() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS shared_client_state (
                    state_key VARCHAR(255) PRIMARY KEY,
                    state_value TEXT,
                    updated_at BIGINT NOT NULL
                )
            """);

            List<String> existing = jdbcTemplate.query(
                    "SELECT state_value FROM shared_client_state WHERE state_key = ?",
                    (rs, rowNum) -> rs.getString("state_value"),
                    INSTANCE_ID_KEY
            );

            if (existing.isEmpty() || existing.get(0) == null || existing.get(0).isBlank()) {
                serverInstanceId = UUID.randomUUID().toString();
                jdbcTemplate.update(
                        "INSERT INTO shared_client_state (state_key, state_value, updated_at) VALUES (?, ?, ?) " +
                        "ON CONFLICT (state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = 0",
                        INSTANCE_ID_KEY,
                        serverInstanceId,
                        0L
                );
            } else {
                serverInstanceId = existing.get(0).trim();
                jdbcTemplate.update(
                        "UPDATE shared_client_state SET updated_at = 0 WHERE state_key = ?",
                        INSTANCE_ID_KEY
                );
            }

            Long maxTs = jdbcTemplate.queryForObject(
                    "SELECT COALESCE(MAX(updated_at), 0) FROM shared_client_state WHERE state_key <> ?",
                    Long.class,
                    INSTANCE_ID_KEY
            );
            if (maxTs != null && maxTs > 0) {
                lastMutationAt.set(maxTs);
            }

            log.info("SharedClientStateController initialized with serverInstanceId={}", serverInstanceId);
        } catch (Exception e) {
            log.warn("Could not initialize shared_client_state table: {}", e.getMessage());
        }

        heartbeatExecutor.scheduleAtFixedRate(this::sendSseHeartbeat, 15, 15, TimeUnit.SECONDS);
    }

    @PreDestroy
    public void shutdownHeartbeat() {
        heartbeatExecutor.shutdownNow();
        for (SseEmitter emitter : sseEmitters) {
            try {
                emitter.complete();
            } catch (Exception ignored) {}
        }
        sseEmitters.clear();
    }

    private void sendSseHeartbeat() {
        if (sseEmitters.isEmpty()) return;
        List<SseEmitter> dead = new ArrayList<>();
        Map<String, Object> payload = Map.of(
                "serverInstanceId", serverInstanceId,
                "updatedAt", lastMutationAt.get(),
                "type", "heartbeat"
        );
        for (SseEmitter emitter : sseEmitters) {
            try {
                emitter.send(SseEmitter.event().comment(SSE_PADDING).name("ping").data(payload));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        if (!dead.isEmpty()) {
            sseEmitters.removeAll(dead);
        }
    }

    public void broadcastSseSync(long updatedAt, String path, String method) {
        if (sseEmitters.isEmpty()) return;
        List<SseEmitter> dead = new ArrayList<>();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("serverInstanceId", serverInstanceId);
        payload.put("updatedAt", updatedAt);
        payload.put("path", path != null ? path : "/api/v1/shared-state");
        payload.put("method", method != null ? method : "SYNC");
        for (SseEmitter emitter : sseEmitters) {
            try {
                emitter.send(SseEmitter.event().comment(SSE_PADDING).name("sync").data(payload));
            } catch (Exception e) {
                dead.add(emitter);
            }
        }
        if (!dead.isEmpty()) {
            sseEmitters.removeAll(dead);
        }
    }

    public void recordBackendMutation(String path, String method) {
        long now = lastMutationAt.updateAndGet(prev -> Math.max(System.currentTimeMillis(), prev + 1));
        try {
            jdbcTemplate.update(
                    "INSERT INTO shared_client_state (state_key, state_value, updated_at) VALUES (?, ?, ?) " +
                    "ON CONFLICT (state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = EXCLUDED.updated_at",
                    REVISION_KEY,
                    String.valueOf(now),
                    now
            );
        } catch (Exception ignored) {}
        broadcastSseSync(now, path, method);
    }

    @Bean
    public FilterRegistrationBean<OncePerRequestFilter> clusterRealtimeMutationFilter() {
        FilterRegistrationBean<OncePerRequestFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
                    throws ServletException, IOException {
                filterChain.doFilter(request, response);
                String method = request.getMethod();
                if (method == null) return;
                String m = method.toUpperCase(Locale.ROOT);
                if (!("POST".equals(m) || "PUT".equals(m) || "PATCH".equals(m) || "DELETE".equals(m))) {
                    return;
                }
                String uri = request.getRequestURI();
                if (uri == null || !uri.startsWith("/api/v1/")) {
                    return;
                }
                if (uri.startsWith("/api/v1/shared-state") ||
                    uri.contains("/api/v1/auth/login") ||
                    uri.contains("/api/v1/auth/refresh-token") ||
                    uri.contains("/api/v1/auth/captcha")) {
                    return;
                }
                if (response.getStatus() < 400) {
                    recordBackendMutation(uri, m);
                }
            }
        });
        reg.setOrder(Ordered.LOWEST_PRECEDENCE);
        return reg;
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamSharedState(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("X-Accel-Buffering", "no");

        SseEmitter emitter = new SseEmitter(0L);
        sseEmitters.add(emitter);

        emitter.onCompletion(() -> sseEmitters.remove(emitter));
        emitter.onTimeout(() -> sseEmitters.remove(emitter));
        emitter.onError((ex) -> sseEmitters.remove(emitter));

        heartbeatExecutor.execute(() -> {
            try {
                Map<String, Object> initPayload = new LinkedHashMap<>();
                initPayload.put("serverInstanceId", serverInstanceId);
                initPayload.put("updatedAt", lastMutationAt.get());
                initPayload.put("type", "connected");
                emitter.send(SseEmitter.event().comment(SSE_PADDING).name("connected").data(initPayload));
            } catch (Exception e) {
                sseEmitters.remove(emitter);
            }
        });

        return emitter;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getSharedState() {
        Map<String, String> entries = new LinkedHashMap<>();
        long maxUpdatedAt = lastMutationAt.get();

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT state_key, state_value, updated_at FROM shared_client_state"
            );
            for (Map<String, Object> row : rows) {
                String k = (String) row.get("state_key");
                String v = (String) row.get("state_value");
                Number ts = (Number) row.get("updated_at");
                if (k == null || INSTANCE_ID_KEY.equals(k)) {
                    continue;
                }
                if (ts != null && ts.longValue() > maxUpdatedAt) {
                    maxUpdatedAt = ts.longValue();
                }
                if (!REVISION_KEY.equals(k) && v != null) {
                    entries.put(k, v);
                }
            }
            if (maxUpdatedAt > lastMutationAt.get()) {
                lastMutationAt.set(maxUpdatedAt);
            }
        } catch (Exception e) {
            log.warn("Failed to read shared_client_state: {}", e.getMessage());
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("serverInstanceId", serverInstanceId);
        response.put("updatedAt", maxUpdatedAt);
        response.put("entries", entries);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> updateSharedState(@RequestBody(required = false) SharedStateUpdateRequest request) {
        long now = lastMutationAt.updateAndGet(prev -> Math.max(System.currentTimeMillis(), prev + 1));
        if (request != null) {
            boolean modified = false;
            try {
                if (request.isReplaceAll()) {
                    jdbcTemplate.update(
                            "DELETE FROM shared_client_state WHERE state_key <> ?",
                            INSTANCE_ID_KEY
                    );
                    modified = true;
                }
                if (request.getRemove() != null) {
                    for (String key : request.getRemove()) {
                        if (key != null && !key.isBlank() && !INSTANCE_ID_KEY.equals(key) && !REVISION_KEY.equals(key)) {
                            jdbcTemplate.update("DELETE FROM shared_client_state WHERE state_key = ?", key.trim());
                            modified = true;
                        }
                    }
                }
                if (request.getUpsert() != null) {
                    for (Map.Entry<String, String> entry : request.getUpsert().entrySet()) {
                        String key = entry.getKey();
                        String val = entry.getValue();
                        if (key != null && !key.isBlank() && !INSTANCE_ID_KEY.equals(key) && !REVISION_KEY.equals(key)) {
                            if (val == null) {
                                jdbcTemplate.update("DELETE FROM shared_client_state WHERE state_key = ?", key.trim());
                            } else {
                                jdbcTemplate.update(
                                        "INSERT INTO shared_client_state (state_key, state_value, updated_at) VALUES (?, ?, ?) " +
                                        "ON CONFLICT (state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = EXCLUDED.updated_at",
                                        key.trim(),
                                        val,
                                        now
                                );
                            }
                            modified = true;
                        }
                    }
                }
                if (modified) {
                    jdbcTemplate.update(
                            "INSERT INTO shared_client_state (state_key, state_value, updated_at) VALUES (?, ?, ?) " +
                            "ON CONFLICT (state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = EXCLUDED.updated_at",
                            REVISION_KEY,
                            String.valueOf(now),
                            now
                    );
                    broadcastSseSync(now, "/api/v1/shared-state", "POST");
                }
            } catch (Exception e) {
                log.warn("Failed to update shared_client_state: {}", e.getMessage());
            }
        }
        return getSharedState();
    }

    @Data
    public static class SharedStateUpdateRequest {
        private Map<String, String> upsert;
        private List<String> remove;
        private boolean replaceAll;
    }
}

