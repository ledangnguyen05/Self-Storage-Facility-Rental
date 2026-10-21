package com.boxora.service;

import com.boxora.dto.request.ChatbotRequest;
import com.boxora.dto.response.ChatbotResponse;

public interface ChatbotService {

    /**
     * Answers one question using the live catalogue of facilities, unit types and policies.
     *
     * @param clientKey identifies the caller for rate limiting (signed-in user or client address)
     * @throws com.boxora.exception.AppException CHATBOT_UNAVAILABLE (503) when no Gemini key is configured or the
     *         model could not be reached, CHATBOT_RATE_LIMITED (429) when the caller asks too often
     */
    ChatbotResponse chat(ChatbotRequest request, String clientKey);
}
