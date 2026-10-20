package com.boxora.service.impl;

import com.boxora.dto.request.GeocodeRequest;
import com.boxora.dto.response.GeocodeResponse;
import com.boxora.service.GeocodingService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@Slf4j
public class GeocodingServiceImpl implements GeocodingService {

    private final String[] apiKeys;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private final String[] models = {
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-2.5-flash-lite"
    };

    private final Map<String, Long> keyCooldowns = new ConcurrentHashMap<>();
    private final AtomicInteger lastWorkingKeyIdx = new AtomicInteger(0);
    private final AtomicInteger lastWorkingModelIdx = new AtomicInteger(0);

    // Cache to prevent duplicate AI calls
    private final Map<String, GeocodeResponse> geocodeCache = new ConcurrentHashMap<>();

    public GeocodingServiceImpl(
            @Value("${gemini.api-keys:}") String configuredKeys,
            ObjectMapper objectMapper
    ) {
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
        if (configuredKeys != null && !configuredKeys.isBlank()) {
            this.apiKeys = Arrays.stream(configuredKeys.split(","))
                    .map(String::trim)
                    .filter(k -> k.length() > 10)
                    .toArray(String[]::new);
        } else {
            this.apiKeys = new String[0];
        }
        log.info("GeocodingServiceImpl initialized with {} Gemini keys", this.apiKeys.length);
    }

    @Override
    public GeocodeResponse geocode(GeocodeRequest request) {
        String query = request.getQuery() != null ? request.getQuery().trim() : "";
        if (query.isEmpty()) {
            return null;
        }

        String cacheKey = query.toLowerCase();
        if (geocodeCache.containsKey(cacheKey)) {
            return geocodeCache.get(cacheKey);
        }

        if (apiKeys.length == 0) {
            log.warn("No Gemini keys available for geocoding query: {}", query);
            return null;
        }

        String prompt = String.format(
                "Bạn là hệ thống định vị & phân giải địa chỉ Việt Nam chuyên nghiệp. " +
                "Hãy tìm tọa độ GPS (vĩ độ latitude, kinh độ longitude) chính xác nhất cho địa chỉ sau:\n" +
                "\"%s\"\n\n" +
                "Quy tắc:\n" +
                "1. Tọa độ phải nằm trong lãnh thổ Việt Nam (Vĩ độ 8.5 đến 23.4, Kinh độ 102.1 đến 109.5).\n" +
                "2. Trả về DUY NHẤT một đối tượng JSON hợp lệ không có markdown backticks (không dùng ```json hay ```), theo cấu trúc:\n" +
                "{\"lat\": number, \"lng\": number, \"displayName\": string}",
                query
        );

        int totalKeys = apiKeys.length;
        int totalModels = models.length;
        int startKeyIdx = lastWorkingKeyIdx.get();
        int startModelIdx = lastWorkingModelIdx.get();

        for (int keyOffset = 0; keyOffset < totalKeys; keyOffset++) {
            int keyIndex = (startKeyIdx + keyOffset) % totalKeys;
            String apiKey = apiKeys[keyIndex];
            int modelStart = (keyOffset == 0) ? startModelIdx : 0;

            for (int modelOffset = 0; modelOffset < totalModels; modelOffset++) {
                int modelIndex = (modelStart + modelOffset) % totalModels;
                String model = models[modelIndex];
                String matrixKey = apiKey + "_" + model;

                Long cooldownUntil = keyCooldowns.get(matrixKey);
                if (cooldownUntil != null && System.currentTimeMillis() < cooldownUntil) {
                    continue;
                }

                try {
                    String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", model);
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    headers.set("x-goog-api-key", apiKey);

                    ObjectNode root = objectMapper.createObjectNode();
                    ArrayNode contents = root.putArray("contents");
                    ObjectNode content = contents.addObject();
                    content.put("role", "user");
                    ArrayNode parts = content.putArray("parts");
                    parts.addObject().put("text", prompt);

                    ObjectNode genConfig = root.putObject("generationConfig");
                    genConfig.put("temperature", 0.1);
                    genConfig.put("maxOutputTokens", 256);

                    HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(root), headers);
                    ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

                    if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                        GeocodeResponse result = parseGeminiResponse(response.getBody(), query);
                        if (result != null) {
                            lastWorkingKeyIdx.set(keyIndex);
                            lastWorkingModelIdx.set(modelIndex);
                            geocodeCache.put(cacheKey, result);
                            return result;
                        }
                    }
                } catch (Exception e) {
                    log.warn("Gemini geocoding failed (model={}, error={})", model, e.getMessage());
                    keyCooldowns.put(matrixKey, System.currentTimeMillis() + 45000);
                }
            }
        }

        return null;
    }

    private GeocodeResponse parseGeminiResponse(String responseJson, String originalQuery) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && !parts.isEmpty()) {
                    String rawText = parts.get(0).path("text").asText();
                    if (rawText != null) {
                        String clean = rawText.replaceAll("(?s)```json\\s*", "")
                                              .replaceAll("(?s)```\\s*", "")
                                              .trim();
                        // Find first '{' and last '}'
                        int start = clean.indexOf('{');
                        int end = clean.lastIndexOf('}');
                        if (start >= 0 && end > start) {
                            clean = clean.substring(start, end + 1);
                        }

                        JsonNode obj = objectMapper.readTree(clean);
                        double lat = obj.path("lat").asDouble(0);
                        double lng = obj.path("lng").asDouble(0);
                        String displayName = obj.path("displayName").asText(originalQuery);

                        // Validate coordinates inside Vietnam bounding box
                        if (lat >= 8.5 && lat <= 23.4 && lng >= 102.1 && lng <= 109.5) {
                            return GeocodeResponse.builder()
                                    .latitude(BigDecimal.valueOf(lat).setScale(6, RoundingMode.HALF_UP))
                                    .longitude(BigDecimal.valueOf(lng).setScale(6, RoundingMode.HALF_UP))
                                    .displayName(displayName)
                                    .source("EXACT")
                                    .provider("boxora-ai")
                                    .confidence("AI Verified Location")
                                    .build();
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse Gemini geocoding payload: {}", e.getMessage());
        }
        return null;
    }
}
