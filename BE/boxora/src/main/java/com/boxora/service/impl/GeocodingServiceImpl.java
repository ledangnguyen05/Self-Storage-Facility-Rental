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
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class GeocodingServiceImpl implements GeocodingService {

    private final String[] apiKeys;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private final String[] models = {
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash"
    };

    private final Map<String, Long> keyCooldowns = new ConcurrentHashMap<>();
    private final AtomicInteger lastWorkingKeyIdx = new AtomicInteger(0);
    private final AtomicInteger lastWorkingModelIdx = new AtomicInteger(0);

    // Cache to prevent duplicate calls and ensure instant repeat queries
    private final Map<String, List<GeocodeResponse>> geocodeCache = new ConcurrentHashMap<>();

    private static final Pattern COORD_PATTERN = Pattern.compile("^\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*[,;\\s]\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*$");

    public GeocodingServiceImpl(
            @Value("${gemini.api-keys:}") String configuredKeys,
            ObjectMapper objectMapper
    ) {
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2500);
        factory.setReadTimeout(4000);
        this.restTemplate = new RestTemplate(factory);

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
        String query = request.getQuery() != null ? request.getQuery().trim().replaceAll("\\s+", " ") : "";
        if (query.isEmpty() || query.length() < 2) {
            return Collections.emptyList();
        }

        String cacheKey = query.toLowerCase();
        if (geocodeCache.containsKey(cacheKey)) {
            return geocodeCache.get(cacheKey);
        }

        // 1. Direct Coordinate Detection (e.g. "10.8467, 106.7774")
        Matcher coordMatcher = COORD_PATTERN.matcher(query);
        if (coordMatcher.matches()) {
            try {
                double lat = Double.parseDouble(coordMatcher.group(1));
                double lng = Double.parseDouble(coordMatcher.group(2));
                if (isValidVietnamCoord(lat, lng)) {
                    List<GeocodeResponse> coordResult = List.of(GeocodeResponse.builder()
                            .latitude(BigDecimal.valueOf(lat).setScale(6, RoundingMode.HALF_UP))
                            .longitude(BigDecimal.valueOf(lng).setScale(6, RoundingMode.HALF_UP))
                            .displayName(String.format("Tọa độ GPS: %.6f, %.6f", lat, lng))
                            .source("EXACT")
                            .provider("coordinates")
                            .confidence("Định vị tọa độ")
                            .build());
                    geocodeCache.put(cacheKey, coordResult);
                    return coordResult;
                }
            } catch (Exception ignored) {}
        }

        // 2. High-speed Gánh Mưu Sinh Geocoding API (sub-second, verified Vietnam Nominatim proxy)
        List<GeocodeResponse> gmsResults = queryGanhMuuSinh(query);
        if (!gmsResults.isEmpty()) {
            geocodeCache.put(cacheKey, gmsResults);
            return gmsResults;
        }

        // 3. Direct OpenStreetMap Nominatim lookup
        List<GeocodeResponse> osmResults = queryNominatim(query);
        if (!osmResults.isEmpty()) {
            geocodeCache.put(cacheKey, osmResults);
            return osmResults;
        }

        // 4. Gemini AI Geocoding fallback if external services fail
        if (apiKeys.length > 0) {
            List<GeocodeResponse> aiResults = queryGemini(query, cacheKey);
            if (!aiResults.isEmpty()) {
                geocodeCache.put(cacheKey, aiResults);
                return aiResults;
            }
        }

        return Collections.emptyList();
    }

    private List<GeocodeResponse> queryGanhMuuSinh(String query) {
        try {
            URI uri = UriComponentsBuilder.fromUriString("https://ganhmuusinh.com/api/v1/geocoding/search")
                    .queryParam("query", query)
                    .build()
                    .encode()
                    .toUri();

            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set("User-Agent", "BoxoraStorage-App/1.0");

            ResponseEntity<String> response = restTemplate.exchange(uri, org.springframework.http.HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode resultsNode = root.path("results");
                if (resultsNode.isArray() && !resultsNode.isEmpty()) {
                    List<GeocodeResponse> list = new ArrayList<>();
                    for (JsonNode item : resultsNode) {
                        double lat = item.path("latitude").asDouble(0);
                        double lng = item.path("longitude").asDouble(0);
                        String name = item.path("display_name").asText("");
                        String type = item.path("type").asText("Địa điểm");

                        if (isValidVietnamCoord(lat, lng) && !name.isBlank()) {
                            list.add(GeocodeResponse.builder()
                                    .latitude(BigDecimal.valueOf(lat).setScale(6, RoundingMode.HALF_UP))
                                    .longitude(BigDecimal.valueOf(lng).setScale(6, RoundingMode.HALF_UP))
                                    .displayName(name)
                                    .source("EXACT")
                                    .provider("ganhmuusinh")
                                    .confidence(type)
                                    .build());
                        }
                    }
                    if (!list.isEmpty()) {
                        return list;
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Gánh Mưu Sinh geocoding query failed: {}", e.getMessage());
        }
        return Collections.emptyList();
    }

    private List<GeocodeResponse> queryNominatim(String query) {
        try {
            URI uri = UriComponentsBuilder.fromUriString("https://nominatim.openstreetmap.org/search")
                    .queryParam("q", query)
                    .queryParam("format", "jsonv2")
                    .queryParam("countrycodes", "vn")
                    .queryParam("limit", 5)
                    .queryParam("addressdetails", 1)
                    .build()
                    .encode()
                    .toUri();

            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            headers.set("User-Agent", "BoxoraStorage-App/1.0 (contact: info@boxora.vn)");

            ResponseEntity<String> response = restTemplate.exchange(uri, org.springframework.http.HttpMethod.GET, new HttpEntity<>(headers), String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode arr = objectMapper.readTree(response.getBody());
                if (arr.isArray() && !arr.isEmpty()) {
                    List<GeocodeResponse> list = new ArrayList<>();
                    for (JsonNode item : arr) {
                        double lat = item.path("lat").asDouble(0);
                        double lng = item.path("lon").asDouble(0);
                        String name = item.path("display_name").asText("");
                        String type = item.path("type").asText("Địa điểm");

                        if (isValidVietnamCoord(lat, lng) && !name.isBlank()) {
                            list.add(GeocodeResponse.builder()
                                    .latitude(BigDecimal.valueOf(lat).setScale(6, RoundingMode.HALF_UP))
                                    .longitude(BigDecimal.valueOf(lng).setScale(6, RoundingMode.HALF_UP))
                                    .displayName(name)
                                    .source("EXACT")
                                    .provider("nominatim")
                                    .confidence(type)
                                    .build());
                        }
                    }
                    if (!list.isEmpty()) {
                        return list;
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Nominatim direct geocoding query failed: {}", e.getMessage());
        }
        return Collections.emptyList();
    }

    private List<GeocodeResponse> queryGemini(String query, String cacheKey) {
        String prompt = String.format(
                "Bạn là hệ thống định vị & Geocoding bản đồ GPS Việt Nam có độ chính xác cao.\n" +
                "Nhiệm vụ: Hãy tìm danh sách từ 2 đến 5 kết quả / gợi ý địa điểm GPS (vĩ độ lat, kinh độ lng) tại Việt Nam cho truy vấn sau:\n" +
                "\"%s\"\n\n" +
                "Tọa độ phải nằm trong lãnh thổ Việt Nam (Vĩ độ 8.5 đến 23.4, Kinh độ 102.1 đến 109.5).\n" +
                "Trả về DUY NHẤT một mảng JSON các đối tượng (không dùng markdown code blocks):\n" +
                "[{\"lat\": number, \"lng\": number, \"displayName\": string, \"type\": string}]",
                query
        );

        int totalKeys = apiKeys.length;
        int keyIndex = lastWorkingKeyIdx.get() % totalKeys;
        String apiKey = apiKeys[keyIndex];
        String model = models[lastWorkingModelIdx.get() % models.length];

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
                return parseGeminiListResponse(response.getBody(), query);
            }
        } catch (Exception e) {
            log.warn("Gemini geocoding attempt failed: {}", e.getMessage());
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

                                if (isValidVietnamCoord(lat, lng)) {
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

    private boolean isValidVietnamCoord(double lat, double lng) {
        return lat >= 8.5 && lat <= 23.4 && lng >= 102.1 && lng <= 109.5;
    }
}

