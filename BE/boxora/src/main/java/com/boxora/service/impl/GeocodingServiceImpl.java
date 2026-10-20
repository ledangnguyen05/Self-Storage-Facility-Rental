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
import java.util.*;
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
    private final Map<String, List<GeocodeResponse>> geocodeCache = new ConcurrentHashMap<>();

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
    public List<GeocodeResponse> geocode(GeocodeRequest request) {
        String query = request.getQuery() != null ? request.getQuery().trim() : "";
        if (query.isEmpty()) {
            return Collections.emptyList();
        }

        String cacheKey = query.toLowerCase();
        if (geocodeCache.containsKey(cacheKey)) {
            return geocodeCache.get(cacheKey);
        }

        if (apiKeys.length == 0) {
            log.warn("No Gemini keys available for geocoding query: {}", query);
            return Collections.emptyList();
        }

        String prompt = String.format(
                "Bạn là hệ thống định vị & Geocoding bản đồ GPS Việt Nam có độ chính xác cao như Google Maps và OpenStreetMap.\n" +
                "Nhiệm vụ: Tìm tọa độ GPS thực tế chính xác (vĩ độ latitude, kinh độ longitude) và tên hiển thị chuẩn xác tại Việt Nam cho truy vấn sau:\n" +
                "\"%s\"\n\n" +
                "Yêu cầu độ chính xác cao:\n" +
                "1. Nếu là địa danh cụ thể (trường học, đại học, bệnh viện, tòa nhà, công viên, địa điểm nổi tiếng như Đại học FPT TP.HCM tại Khu Công nghệ cao đường D1 Long Thạnh Mỹ, Landmark 81, v.v.): BẮT BUỘC trả về tọa độ thực tế chính xác của khuôn viên / cổng chính địa điểm đó (ví dụ Đại học FPT TP.HCM là ~10.8414, 106.8100), TUYỆT ĐỐI KHÔNG lấy tọa độ chung chung của tâm Quận hay tâm Phường.\n" +
                "2. Nếu là số nhà và tên đường: Hãy xác định vị trí chính xác dọc theo tuyến đường thuộc phường/xã, quận/huyện, tỉnh/thành phố tương ứng.\n" +
                "3. Tọa độ phải nằm trong lãnh thổ Việt Nam (Vĩ độ 8.5 đến 23.4, Kinh độ 102.1 đến 109.5).\n" +
                "4. Trả về DUY NHẤT một mảng JSON các đối tượng (không có markdown backticks, không dùng ```json hay ```), theo cấu trúc:\n" +
                "[{\"lat\": number, \"lng\": number, \"displayName\": string, \"type\": string}]",
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
                    genConfig.put("maxOutputTokens", 512);

                    HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(root), headers);
                    ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

                    if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                        List<GeocodeResponse> results = parseGeminiListResponse(response.getBody(), query);
                        if (!results.isEmpty()) {
                            lastWorkingKeyIdx.set(keyIndex);
                            lastWorkingModelIdx.set(modelIndex);
                            geocodeCache.put(cacheKey, results);
                            return results;
                        }
                    }
                } catch (Exception e) {
                    log.warn("Gemini geocoding failed (model={}, error={})", model, e.getMessage());
                    keyCooldowns.put(matrixKey, System.currentTimeMillis() + 45000);
                }
            }
        }

        return Collections.emptyList();
    }

    private List<GeocodeResponse> parseGeminiListResponse(String responseJson, String originalQuery) {
        List<GeocodeResponse> results = new ArrayList<>();
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
                        // Find first '[' or '{'
                        int startArr = clean.indexOf('[');
                        int endArr = clean.lastIndexOf(']');
                        int startObj = clean.indexOf('{');
                        int endObj = clean.lastIndexOf('}');

                        if (startArr >= 0 && endArr > startArr) {
                            clean = clean.substring(startArr, endArr + 1);
                        } else if (startObj >= 0 && endObj > startObj) {
                            clean = "[" + clean.substring(startObj, endObj + 1) + "]";
                        }

                        JsonNode arr = objectMapper.readTree(clean);
                        if (arr.isArray()) {
                            for (JsonNode item : arr) {
                                double lat = item.path("lat").asDouble(0);
                                double lng = item.path("lng").asDouble(0);
                                String displayName = item.path("displayName").asText(originalQuery);
                                String type = item.path("type").asText("Địa điểm");

                                if (lat >= 8.5 && lat <= 23.4 && lng >= 102.1 && lng <= 109.5) {
                                    results.add(GeocodeResponse.builder()
                                            .latitude(BigDecimal.valueOf(lat).setScale(6, RoundingMode.HALF_UP))
                                            .longitude(BigDecimal.valueOf(lng).setScale(6, RoundingMode.HALF_UP))
                                            .displayName(displayName)
                                            .source("EXACT")
                                            .provider("boxora-ai")
                                            .confidence(type)
                                            .build());
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse Gemini geocoding payload: {}", e.getMessage());
        }
        return results;
    }
}
