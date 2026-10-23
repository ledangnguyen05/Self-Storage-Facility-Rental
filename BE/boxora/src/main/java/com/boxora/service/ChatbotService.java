package com.boxora.service;

import com.boxora.dto.request.ChatbotRequest;
import com.boxora.dto.response.ChatbotResponse;

public interface ChatbotService {
    ChatbotResponse chat(ChatbotRequest request);
}
