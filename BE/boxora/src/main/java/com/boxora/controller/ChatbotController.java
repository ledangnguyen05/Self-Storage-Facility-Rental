package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.ChatbotRequest;
import com.boxora.dto.response.ChatbotResponse;
import com.boxora.service.ChatbotService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/chatbot")
@Tag(name = "Chatbot", description = "API trợ lý ảo AI Boxora (công khai, giới hạn tần suất)")
@RequiredArgsConstructor
@Slf4j
public class ChatbotController {

    private final ChatbotService chatbotService;

    @PostMapping("/chat")
    @Operation(summary = "Gửi tin nhắn hỏi đáp với Boxora AI; trả 503 khi trợ lý chưa được cấu hình hoặc không kết nối được, 429 khi hỏi quá nhanh")
    public ResponseEntity<ApiResponse<ChatbotResponse>> chat(
            @Valid @RequestBody ChatbotRequest request,
            HttpServletRequest httpRequest,
            Authentication authentication
    ) {
        ChatbotResponse response = chatbotService.chat(request, callerKey(httpRequest, authentication));
        return ResponseEntity.ok(ApiResponse.success("Phản hồi từ Boxora AI", response));
    }

    /** Signed-in users are limited per account, everyone else per client address. */
    private static String callerKey(HttpServletRequest request, Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.getName() != null) {
            return "user:" + authentication.getName();
        }
        return "ip:" + request.getRemoteAddr();
    }
}
