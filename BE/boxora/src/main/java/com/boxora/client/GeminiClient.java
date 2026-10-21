package com.boxora.client;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Minimal Google Gemini REST client (generateContent). It rotates over the configured API keys and models,
 * puts a failing key/model pair on cool-down, and sends the key in a header so it can never end up in a URL
 * that is logged. Keys stay on the server; the web app only talks to {@code /api/v1/chatbot/chat}.
 */
@Component
@Slf4j
public class GeminiClient {

    private static final String GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
    private static final String API_KEY_HEADER = "x-goog-api-key";

    private static final long COOLDOWN_RATE_LIMIT_MS = Duration.ofSeconds(60).toMillis();
    private static final long COOLDOWN_SERVER_ERROR_MS = Duration.ofSeconds(30).toMillis();
    private static final long COOLDOWN_BAD_KEY_MS = Duration.ofMinutes(10).toMillis();
    private static final long COOLDOWN_MODEL_GONE_MS = Duration.ofHours(1).toMillis();

    /** One turn of the conversation sent to the model. {@code role} is {@code user} or {@code model}. */
    public record Turn(String role, String text) {
    }

    private final String[] apiKeys;
    private final String[] models;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    /** Cool-down end (epoch millis) per "keyIndex:model" pair. */
    private final Map<String, Long> cooldowns = new ConcurrentHashMap<>();
    private final AtomicInteger lastWorkingKey = new AtomicInteger(0);
    private final AtomicInteger lastWorkingModel = new AtomicInteger(0);

    public GeminiClient(
            @Value("${gemini.api-keys:}") String configuredKeys,
            @Value("${gemini.models:gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash}") String configuredModels,
            ObjectMapper objectMapper
    ) {
        this.objectMapper = objectMapper;
        // Template values such as "your_gemini_api_key_1" (copied from .env.example) are not keys.
        this.apiKeys = Arrays.stream(split(configuredKeys, 10))
                .filter(key -> !key.toLowerCase(java.util.Locale.ROOT).startsWith("your_"))
                .toArray(String[]::new);
        this.models = split(configuredModels, 1);

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(5).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(25).toMillis());
        this.restClient = RestClient.builder().requestFactory(factory).build();

        log.info("Gemini client ready: {} API key(s), models {}", apiKeys.length, Arrays.toString(models));
    }

    /** True when at least one API key and one model are configured. */
    public boolean isConfigured() {
        return apiKeys.length > 0 && models.length > 0;
    }

    /**
     * Sends the conversation and returns the model's text.
     *
     * @return the reply, or empty when the model answered without text (for example a safety block)
     * @throws AppException CHATBOT_UNAVAILABLE when nothing is configured or every key/model failed
     */
    public Optional<String> generate(String systemPrompt, List<Turn> turns) {
        if (!isConfigured()) {
            throw new AppException(ErrorCode.CHATBOT_UNAVAILABLE);
        }

        String body = buildPayload(systemPrompt, turns);
        int startKey = lastWorkingKey.get();
        int startModel = lastWorkingModel.get();

        for (int keyOffset = 0; keyOffset < apiKeys.length; keyOffset++) {
            int keyIndex = (startKey + keyOffset) % apiKeys.length;
            int firstModel = keyOffset == 0 ? startModel : 0;

            for (int modelOffset = 0; modelOffset < models.length; modelOffset++) {
                int modelIndex = (firstModel + modelOffset) % models.length;
                String model = models[modelIndex];
                String cooldownKey = keyIndex + ":" + model;

                Long until = cooldowns.get(cooldownKey);
                if (until != null && System.currentTimeMillis() < until) {
                    continue;
                }

                try {
                    String response = restClient.post()
                            .uri(GENERATE_URL, model)
                            .header(API_KEY_HEADER, apiKeys[keyIndex])
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(body)
                            .retrieve()
                            .body(String.class);

                    lastWorkingKey.set(keyIndex);
                    lastWorkingModel.set(modelIndex);
                    return extractText(response);
                } catch (RestClientResponseException e) {
                    int status = e.getStatusCode().value();
                    cooldowns.put(cooldownKey, System.currentTimeMillis() + cooldownFor(status));
                    // Only the status is logged: the response body of a bad request can echo request details.
                    log.warn("Gemini call failed (model={}, keyIndex={}, status={})", model, keyIndex, status);
                } catch (Exception e) {
                    cooldowns.put(cooldownKey, System.currentTimeMillis() + COOLDOWN_SERVER_ERROR_MS);
                    log.warn("Gemini call failed (model={}, keyIndex={}): {}", model, keyIndex, e.getClass().getSimpleName());
                }
            }
        }

        throw new AppException(ErrorCode.CHATBOT_UNAVAILABLE);
    }

    private static long cooldownFor(int status) {
        return switch (status) {
            case 400, 401, 403 -> COOLDOWN_BAD_KEY_MS;
            case 404 -> COOLDOWN_MODEL_GONE_MS;
            case 429 -> COOLDOWN_RATE_LIMIT_MS;
            default -> COOLDOWN_SERVER_ERROR_MS;
        };
    }

    private String buildPayload(String systemPrompt, List<Turn> turns) {
        ObjectNode root = objectMapper.createObjectNode();
        root.putObject("system_instruction").putArray("parts").addObject().put("text", systemPrompt);

        ArrayNode contents = root.putArray("contents");
        for (Turn turn : turns) {
            ObjectNode content = contents.addObject();
            content.put("role", turn.role());
            content.putArray("parts").addObject().put("text", turn.text());
        }

        ObjectNode generationConfig = root.putObject("generationConfig");
        generationConfig.put("temperature", 0.3);
        generationConfig.put("maxOutputTokens", 800);
        generationConfig.put("topP", 0.85);
        return root.toString();
    }

    private Optional<String> extractText(String responseJson) {
        if (responseJson == null || responseJson.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode parts = objectMapper.readTree(responseJson).path("candidates").path(0).path("content").path("parts");
            StringBuilder text = new StringBuilder();
            if (parts.isArray()) {
                for (JsonNode part : parts) {
                    text.append(part.path("text").asText(""));
                }
            }
            String reply = text.toString().trim();
            return reply.isEmpty() ? Optional.empty() : Optional.of(reply);
        } catch (Exception e) {
            log.error("Could not parse the Gemini response: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    private static String[] split(String raw, int minLength) {
        if (raw == null || raw.isBlank()) {
            return new String[0];
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> value.length() >= minLength)
                .toArray(String[]::new);
    }
}
