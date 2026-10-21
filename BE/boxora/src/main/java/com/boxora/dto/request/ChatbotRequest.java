package com.boxora.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatbotRequest {

    /** Longest question accepted, in characters. The chat widget enforces the same limit. */
    public static final int MAX_MESSAGE_LENGTH = 1000;
    /** Most earlier turns accepted in one request. */
    public static final int MAX_HISTORY_SIZE = 20;
    /** Longest earlier turn accepted, in characters. */
    public static final int MAX_HISTORY_CONTENT_LENGTH = 4000;

    @NotBlank(message = "Nội dung câu hỏi không được để trống")
    @Size(max = MAX_MESSAGE_LENGTH, message = "Câu hỏi quá dài, tối đa 1000 ký tự")
    private String message;

    @Size(max = MAX_HISTORY_SIZE, message = "Lịch sử hội thoại quá dài")
    @Valid
    private List<ChatMessageDto> history;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatMessageDto {
        @Pattern(regexp = "(?i)user|assistant", message = "Vai trò tin nhắn không hợp lệ")
        private String role; // "user" or "assistant"

        @Size(max = MAX_HISTORY_CONTENT_LENGTH, message = "Tin nhắn trong lịch sử quá dài")
        private String content;
    }
}
