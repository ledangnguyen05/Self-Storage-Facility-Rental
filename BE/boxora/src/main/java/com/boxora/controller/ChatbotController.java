package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.ChatbotRequest;
import com.boxora.dto.response.ChatbotResponse;
import com.boxora.service.ChatbotService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/chatbot")
@Tag(name = "Chatbot", description = "API trợ lý ảo AI Boxora 24/7")
@RequiredArgsConstructor
@Slf4j
public class ChatbotController {

    private final ChatbotService chatbotService;

    @PostMapping("/chat")
    @Operation(summary = "Gửi tin nhắn hỏi đáp với Boxora AI")
    public ResponseEntity<ApiResponse<ChatbotResponse>> chat(
            @Valid @RequestBody ChatbotRequest request
    ) {
        ChatbotResponse response = chatbotService.chat(request);
        return ResponseEntity.ok(ApiResponse.success("Phản hồi từ Boxora AI", response));
    }
}
