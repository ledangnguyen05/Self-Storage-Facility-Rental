package com.boxora.client;

import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Configuration handling only: nothing here reaches the network. */
class GeminiClientTest {

    private static final String DEFAULT_MODELS = "gemini-2.5-flash,gemini-2.5-flash-lite";

    private static GeminiClient client(String keys, String models) {
        return new GeminiClient(keys, models, new ObjectMapper());
    }

    @Test
    @DisplayName("No key means not configured, and generate() fails with 503 before any request")
    void noKeyIsUnavailable() {
        GeminiClient client = client("", DEFAULT_MODELS);

        assertThat(client.isConfigured()).isFalse();
        assertThatThrownBy(() -> client.generate("prompt", List.of(new GeminiClient.Turn("user", "hi"))))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CHATBOT_UNAVAILABLE);
                    assertThat(e.getErrorCode().getHttpStatus().value()).isEqualTo(503);
                });
    }

    @Test
    @DisplayName("Template values from .env.example and too-short tokens are not keys")
    void placeholderKeysAreIgnored() {
        assertThat(client("your_gemini_api_key_1,your_gemini_api_key_2", DEFAULT_MODELS).isConfigured()).isFalse();
        assertThat(client("short, ,abc", DEFAULT_MODELS).isConfigured()).isFalse();
        assertThat(client(null, DEFAULT_MODELS).isConfigured()).isFalse();
    }

    @Test
    @DisplayName("A real-looking key is accepted next to placeholders")
    void realKeyIsAccepted() {
        assertThat(client("your_gemini_api_key_1, AIzaSyExampleExampleExample123456", DEFAULT_MODELS).isConfigured()).isTrue();
    }

    @Test
    @DisplayName("Without any model the client is not configured")
    void noModelIsNotConfigured() {
        assertThat(client("AIzaSyExampleExampleExample123456", " ").isConfigured()).isFalse();
    }
}
