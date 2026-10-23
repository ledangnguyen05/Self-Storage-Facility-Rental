package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatbotRequest {

    @NotBlank(message = "Nội dung câu hỏi không được để trống")
    private String message;

    private List<ChatMessageDto> history;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatMessageDto {
        private String role; // "user" or "assistant"
        private String content;
    }
}
