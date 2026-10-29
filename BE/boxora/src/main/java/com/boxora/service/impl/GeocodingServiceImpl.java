package com.boxora.service.impl;

import com.boxora.dto.request.GeocodeRequest;
import com.boxora.dto.response.GeocodeResponse;
import com.boxora.service.GeocodingService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Geocoding dựa trên dữ liệu bản đồ thật (OpenStreetMap): Photon (chính) + Nominatim (dự phòng).
 * Chỉ trả về kết quả nằm trong lãnh thổ Việt Nam; tự thu gọn truy vấn khi không có kết quả.
 */
@Service
@Slf4j
public class GeocodingServiceImpl implements GeocodingService {

    private static final double MIN_LAT = 8.3;
    private static final double MAX_LAT = 23.5;
    private static final double MIN_LNG = 102.1;
    private static final double MAX_LNG = 109.6;
    private static final int MAX_CACHE_SIZE = 500;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final Map<String, List<GeocodeResponse>> geocodeCache = new ConcurrentHashMap<>();

    public GeocodingServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(5000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public List<GeocodeResponse> geocode(GeocodeRequest request) {
        String raw = request.getQuery() != null ? request.getQuery().trim() : "";
        if (raw.isEmpty()) {
            return Collections.emptyList();
        }

        String cacheKey = raw.toLowerCase();
        List<GeocodeResponse> cached = geocodeCache.get(cacheKey);
        if (cached != null) {
            return cached;
        }

        for (String query : buildQueryVariants(raw)) {
            List<GeocodeResponse> results = searchPhoton(query);
            if (results.isEmpty()) {
                results = searchNominatim(query);
            }
            if (!results.isEmpty()) {
                if (geocodeCache.size() >= MAX_CACHE_SIZE) {
                    geocodeCache.clear();
                }
                geocodeCache.put(cacheKey, results);
                return results;
            }
        }
        return Collections.emptyList();
    }

    private List<String> buildQueryVariants(String raw) {
        String base = raw.replaceAll("(?i),?\\s*(việt\\s*nam|vietnam|viet\\s*nam)\\s*$", "").trim();
        Set<String> variants = new LinkedHashSet<>();
        variants.add(base);

        String noHouse = base.replaceFirst("^\\s*\\d+[\\w/-]*\\s+", "");
        if (!noHouse.equals(base) && noHouse.length() >= 3) {
            variants.add(noHouse);
        }

        String[] parts = base.split(",");
        if (parts.length > 2) {
            variants.add(String.join(",", java.util.Arrays.copyOfRange(parts, 0, 2)).trim());
        }
        if (parts.length > 3) {
            variants.add(String.join(",", java.util.Arrays.copyOfRange(parts, 0, 3)).trim());
        }
        variants.removeIf(v -> v.length() < 2);
        return new ArrayList<>(variants);
    }

    private List<GeocodeResponse> searchPhoton(String query) {
        List<GeocodeResponse> out = new ArrayList<>();
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl("https://photon.komoot.io/api/")
                    .queryParam("q", query)
                    .queryParam("limit", 6)
                    .queryParam("lat", 10.7769)
                    .queryParam("lon", 106.7009)
                    .queryParam("bbox", MIN_LNG + "," + MIN_LAT + "," + MAX_LNG + "," + MAX_LAT)
                    .build()
                    .encode()
                    .toUri();
            JsonNode root = fetch(uri);
            JsonNode features = root == null ? null : root.path("features");
            if (features != null && features.isArray()) {
                for (JsonNode f : features) {
                    JsonNode coords = f.path("geometry").path("coordinates");
                    if (!coords.isArray() || coords.size() < 2) continue;
                    double lng = coords.get(0).asDouble();
                    double lat = coords.get(1).asDouble();
                    if (!inVietnam(lat, lng)) continue;

                    JsonNode p = f.path("properties");
                    String cc = p.path("countrycode").asText("");
                    if (!cc.isEmpty() && !"VN".equalsIgnoreCase(cc)) continue;

                    String house = p.path("housenumber").asText("");
                    String street = p.path("street").asText("");
                    String name = p.path("name").asText("");
                    String streetLine;
                    if (!house.isEmpty()) {
                        streetLine = (house + " " + (street.isEmpty() ? name : street)).trim();
                    } else if (!street.isEmpty() && !name.isEmpty() && !name.equals(street)) {
                        streetLine = name + ", " + street;
                    } else {
                        streetLine = name.isEmpty() ? street : name;
                    }
                    String display = joinUnique(streetLine, p.path("locality").asText(""), p.path("district").asText(""),
                            firstNonBlank(p.path("city").asText(""), p.path("county").asText("")),
                            p.path("state").asText(""));
                    out.add(build(lat, lng, display.isEmpty() ? query : display, !house.isEmpty(), "photon"));
                }
            }
        } catch (Exception e) {
            log.warn("Photon geocoding failed: {}", e.getMessage());
        }
        return out;
    }

    private List<GeocodeResponse> searchNominatim(String query) {
        List<GeocodeResponse> out = new ArrayList<>();
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl("https://nominatim.openstreetmap.org/search")
                    .queryParam("q", query)
                    .queryParam("format", "jsonv2")
                    .queryParam("addressdetails", 1)
                    .queryParam("countrycodes", "vn")
                    .queryParam("accept-language", "vi")
                    .queryParam("limit", 6)
                    .build()
                    .encode()
                    .toUri();
            JsonNode root = fetch(uri);
            if (root != null && root.isArray()) {
                for (JsonNode item : root) {
                    double lat = item.path("lat").asDouble(0);
                    double lng = item.path("lon").asDouble(0);
                    if (!inVietnam(lat, lng)) continue;

                    JsonNode a = item.path("address");
                    String house = a.path("house_number").asText("");
                    String road = a.path("road").asText("");
                    String streetLine = !house.isEmpty() ? (house + " " + road).trim()
                            : firstNonBlank(road, item.path("name").asText(""));
                    String display = joinUnique(streetLine,
                            firstNonBlank(a.path("quarter").asText(""), a.path("suburb").asText(""),
                                    a.path("neighbourhood").asText(""), a.path("village").asText("")),
                            firstNonBlank(a.path("city_district").asText(""), a.path("county").asText("")),
                            firstNonBlank(a.path("city").asText(""), a.path("town").asText(""), a.path("state").asText("")));
                    if (display.isEmpty()) {
                        display = item.path("display_name").asText(query);
                    }
                    out.add(build(lat, lng, display, !house.isEmpty(), "nominatim"));
                }
            }
        } catch (Exception e) {
            log.warn("Nominatim geocoding failed: {}", e.getMessage());
        }
        return out;
    }

    private JsonNode fetch(URI uri) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, "BoxoraSelfStorage/1.0 (boxoradistrict1@gmail.com)");
        headers.set(HttpHeaders.ACCEPT, "application/json");
        ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        if (response.getBody() == null) return null;
        return objectMapper.readTree(response.getBody());
    }

    private GeocodeResponse build(double lat, double lng, String display, boolean exact, String provider) {
        return GeocodeResponse.builder()
                .latitude(BigDecimal.valueOf(lat).setScale(6, RoundingMode.HALF_UP))
                .longitude(BigDecimal.valueOf(lng).setScale(6, RoundingMode.HALF_UP))
                .displayName(display)
                .source(exact ? "EXACT" : "APPROXIMATE")
                .provider(provider)
                .confidence(exact ? "Chính xác số nhà" : "Gần đúng")
                .build();
    }

    private boolean inVietnam(double lat, double lng) {
        return lat >= MIN_LAT && lat <= MAX_LAT && lng >= MIN_LNG && lng <= MAX_LNG;
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return "";
    }

    private String joinUnique(String... parts) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (String raw : parts) {
            String p = raw == null ? "" : raw.trim();
            if (p.isEmpty()) continue;
            if (seen.add(p.toLowerCase())) out.add(p);
        }
        return String.join(", ", out);
    }
}
