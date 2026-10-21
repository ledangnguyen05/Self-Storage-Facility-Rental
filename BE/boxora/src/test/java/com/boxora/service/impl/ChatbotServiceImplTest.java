package com.boxora.service.impl;

import com.boxora.client.GeminiClient;
import com.boxora.client.GeminiClient.Turn;
import com.boxora.dto.request.ChatbotRequest;
import com.boxora.dto.response.ChatbotResponse;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatbotServiceImplTest {

    @Mock private GeminiClient geminiClient;
    @Mock private ChatbotContextProvider contextProvider;
    @Mock private ChatbotRateLimiter rateLimiter;

    private ChatbotServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ChatbotServiceImpl(geminiClient, contextProvider, rateLimiter);
        when(geminiClient.isConfigured()).thenReturn(true);
        when(contextProvider.currentContext()).thenReturn("1. Boxora District 1 - 123 Nguyen Hue");
        when(geminiClient.generate(anyString(), anyList())).thenReturn(Optional.of("Xin chào"));
    }

    private static ChatbotRequest request(String message, List<ChatbotRequest.ChatMessageDto> history) {
        return ChatbotRequest.builder().message(message).history(history).build();
    }

    private static ChatbotRequest.ChatMessageDto turn(String role, String content) {
        return ChatbotRequest.ChatMessageDto.builder().role(role).content(content).build();
    }

    @Test
    @DisplayName("Without a Gemini key the service answers 503 instead of an ops message, and spends no rate-limit quota")
    void unconfiguredIsServiceUnavailable() {
        when(geminiClient.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.chat(request("Giá thuê kho?", null), "ip:1"))
                .isInstanceOfSatisfying(AppException.class, e -> {
                    assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CHATBOT_UNAVAILABLE);
                    assertThat(e.getErrorCode().getHttpStatus().value()).isEqualTo(503);
                    assertThat(e.getMessage()).doesNotContain("GEMINI").doesNotContain(".env");
                });
        verifyNoInteractions(rateLimiter);
        verify(geminiClient, never()).generate(anyString(), anyList());
    }

    @Test
    @DisplayName("Empty or oversized questions are rejected before any model call")
    void invalidQuestionIsRejected() {
        assertThatThrownBy(() -> service.chat(request("   ", null), "ip:1"))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CHATBOT_MESSAGE_INVALID));
        assertThatThrownBy(() -> service.chat(request("x".repeat(ChatbotRequest.MAX_MESSAGE_LENGTH + 1), null), "ip:1"))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CHATBOT_MESSAGE_INVALID));
        verify(geminiClient, never()).generate(anyString(), anyList());
    }

    @Test
    @DisplayName("The rate limit is applied per caller and its error is passed on")
    void rateLimitIsApplied() {
        doThrow(new AppException(ErrorCode.CHATBOT_RATE_LIMITED)).when(rateLimiter).acquire("ip:9.9.9.9");

        assertThatThrownBy(() -> service.chat(request("Xin chào", null), "ip:9.9.9.9"))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CHATBOT_RATE_LIMITED));
        verify(geminiClient, never()).generate(anyString(), anyList());
    }

    @Test
    @DisplayName("The system prompt is the rule set plus the live catalogue, and nothing is hard-coded about branches, prices or insurance")
    @SuppressWarnings("unchecked")
    void promptCarriesLiveData() {
        ChatbotResponse response = service.chat(request("Địa chỉ cơ sở ở đâu?", null), "ip:1");

        assertThat(response.getReply()).isEqualTo("Xin chào");
        ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
        verify(geminiClient).generate(prompt.capture(), anyList());
        verify(rateLimiter).acquire("ip:1");
        assertThat(prompt.getValue()).contains("1. Boxora District 1 - 123 Nguyen Hue");
        assertThat(prompt.getValue())
                .doesNotContain("Bình Thạnh").doesNotContain("Thủ Đức").doesNotContain("Quận 7")
                .doesNotContain("50.000.000").doesNotContain("Bảo hiểm cháy nổ")
                .doesNotContain("150.000").doesNotContain("Climate-Controlled");
        assertThat(ChatbotServiceImpl.SYSTEM_PROMPT).contains("24/7").contains("Không nói kho mở cửa");
    }

    @Test
    @DisplayName("Only the last 10 earlier turns are sent, long turns are cut, and the conversation opens with a user turn")
    @SuppressWarnings("unchecked")
    void historyIsCapped() {
        List<ChatbotRequest.ChatMessageDto> history = new ArrayList<>();
        history.add(turn("assistant", "Bot mở đầu"));
        for (int i = 0; i < 14; i++) {
            history.add(turn(i % 2 == 0 ? "user" : "assistant", "tin " + i));
        }
        history.add(turn("user", "y".repeat(5000)));

        service.chat(request("Câu hỏi mới", history), "ip:1");

        ArgumentCaptor<List<Turn>> turns = ArgumentCaptor.forClass(List.class);
        verify(geminiClient).generate(anyString(), turns.capture());
        List<Turn> sent = turns.getValue();
        assertThat(sent).hasSizeLessThanOrEqualTo(ChatbotServiceImpl.MAX_HISTORY_TURNS + 1);
        assertThat(sent.get(0).role()).isEqualTo("user");
        assertThat(sent.get(sent.size() - 1)).isEqualTo(new Turn("user", "Câu hỏi mới"));
        assertThat(sent).allSatisfy(t -> assertThat(t.text().length()).isLessThanOrEqualTo(ChatbotServiceImpl.MAX_TURN_CHARS));
        assertThat(sent).extracting(Turn::text).doesNotContain("Bot mở đầu", "tin 0");
    }

    @Test
    @DisplayName("Roles are mapped to the Gemini names and unknown roles never become the model")
    void rolesAreMapped() {
        List<Turn> turns = ChatbotServiceImpl.buildTurns(
                List.of(turn("user", "a"), turn("assistant", "b"), turn("system", "c"), turn(null, "d")), "e");

        assertThat(turns).extracting(Turn::role).containsExactly("user", "model", "user", "user", "user");
    }

    @Test
    @DisplayName("When the model returns no text (safety block) the user gets a polite fixed reply, not an error")
    void blockedAnswerGetsPoliteReply() {
        when(geminiClient.generate(anyString(), anyList())).thenReturn(Optional.empty());

        assertThat(service.chat(request("...", null), "ip:1").getReply()).isEqualTo(ChatbotServiceImpl.BLOCKED_REPLY);
    }

    @Test
    @DisplayName("A model outage is a 503, never a fake reply")
    void modelOutageIsServiceUnavailable() {
        when(geminiClient.generate(anyString(), anyList())).thenThrow(new AppException(ErrorCode.CHATBOT_UNAVAILABLE));

        assertThatThrownBy(() -> service.chat(request("Xin chào", null), "ip:1"))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CHATBOT_UNAVAILABLE));
    }

    @Test
    @DisplayName("The client key is forwarded to the limiter unchanged")
    void clientKeyIsForwarded() {
        service.chat(request("Xin chào", null), "user:khach@example.com");

        verify(rateLimiter).acquire(eq("user:khach@example.com"));
        verify(geminiClient).generate(any(), anyList());
    }
}
