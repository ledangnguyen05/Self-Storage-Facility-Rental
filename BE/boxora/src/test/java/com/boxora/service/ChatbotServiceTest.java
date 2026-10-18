package com.boxora.service;

import com.boxora.dto.request.ChatbotRequest;
import com.boxora.dto.response.ChatbotResponse;
import com.boxora.service.impl.ChatbotServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ChatbotServiceTest {

    @Test
    void missingGeminiKeysReturnFriendlyUnavailableMessageWithoutExposingSecrets() {
        ChatbotServiceImpl service = new ChatbotServiceImpl("", new ObjectMapper());

        ChatbotResponse response = service.chat(ChatbotRequest.builder()
                .message("How do I rent a unit?")
                .build());

        assertThat(response.getStatus()).isEqualTo("UNAVAILABLE");
        assertThat(response.getReply()).contains("temporarily unavailable");
        assertThat(response.getReply()).doesNotContain("GEMINI_API_KEYS");
    }
}
