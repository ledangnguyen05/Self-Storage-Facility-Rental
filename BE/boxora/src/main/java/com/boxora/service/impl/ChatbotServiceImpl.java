package com.boxora.service.impl;

import com.boxora.dto.request.ChatbotRequest;
import com.boxora.dto.response.ChatbotResponse;
import com.boxora.service.ChatbotService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@Slf4j
public class ChatbotServiceImpl implements ChatbotService {

    private final String[] apiKeys;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private final String[] models = {
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-2.5-flash-lite"
    };

    private final Map<String, Long> keyCooldowns = new ConcurrentHashMap<>();
    private final AtomicInteger lastWorkingKeyIdx = new AtomicInteger(0);
    private final AtomicInteger lastWorkingModelIdx = new AtomicInteger(0);

    private static final String BOXORA_SYSTEM_PROMPT = """
            Bạn là "Boxora AI" — Chuyên viên tư vấn & trợ lý ảo thông minh 24/7 của Hệ thống Kho Tự Quản Thông Minh Boxora (Boxora Smart Self-Storage Facility Rental).

            🏢 THÔNG TIN VỀ BOXORA:
            - Boxora là nền tảng tiên phong tại Việt Nam cung cấp dịch vụ cho thuê kho mini tự quản, kho cá nhân, kho doanh nghiệp tích hợp công nghệ IoT (Smart Lock, QR Check-in, Giám sát nhiệt độ độ ẩm thời gian thực 24/7).
            - Khách hàng có toàn quyền ra vào 24/7 không cần nhân viên trực bằng mã Smart Key (mã PIN hoặc QR code) nhận trên điện thoại.

            📍 CÁC CHI NHÁNH HIỆN CÓ:
            1. Boxora Thủ Đức: Khu Công Nghệ Cao, P. Tăng Nhơn Phú B, TP. Thủ Đức, TP.HCM (Mở cửa 24/7).
            2. Boxora Quận 7: 104 Nguyễn Thị Thập, P. Tân Hưng, Quận 7, TP.HCM (Mở cửa 24/7).
            3. Boxora Bình Thạnh: 45 Đinh Bộ Lĩnh, P. 26, Q. Bình Thạnh, TP.HCM (Mở cửa 24/7).
            4. Boxora Tân Bình: 202 Hoàng Văn Thụ, P. 9, Q. Tân Bình, TP.HCM (Mở cửa 24/7).

            📦 CÁC LOẠI KHO VÀ MỨC GIÁ THAM KHẢO:
            - Locker Mini (0.5m³ - 1.2m³): Cất balo, vali, hồ sơ, đồ công nghệ, tài liệu cá nhân. Giá từ: 150.000đ - 350.000đ/tháng.
            - Kho Cá Nhân Compact (2m³ - 4m³): Đồ đạc sinh viên, phụ kiện, dụng cụ thể thao, quần áo mùa đông. Giá từ: 500.000đ - 900.000đ/tháng.
            - Kho Tiêu Chuẩn Standard (5m³ - 10m³): Chứa toàn bộ nội thất căn hộ 1-2 phòng ngủ khi sửa nhà, chuyển dọn. Giá từ: 1.200.000đ - 2.500.000đ/tháng.
            - Kho Doanh Nghiệp Business (12m³ - 30m³): Hàng hóa kinh doanh online, thiết bị livestream, hàng tồn kho. Giá từ: 3.000.000đ - 6.500.000đ/tháng.
            - Kho Lạnh Điều Hòa (Climate-Controlled): Luôn duy trì 18°C - 24°C, độ ẩm < 55%, bảo quản rượu vang, mỹ phẩm, đồ da, linh kiện cao cấp.

            🚀 QUY TRÌNH THUÊ VÀ SỬ DỤNG:
            1. Đặt kho online: Chọn chi nhánh, loại kho, thời hạn thuê tại trang [Khám phá kho](/units).
            2. Thanh toán trực tuyến: Hỗ trợ thanh toán nhanh qua VNPay (ATM/QR/Thẻ quốc tế) hoặc chuyển khoản ngân hàng.
            3. Nhận Smart Key: Hợp đồng điện tử ký số tự động và cấp Smart Key (mã OTP/QR mở khóa điện tử) ngay tại [Cổng Khách Hàng](/customer).
            4. Check-in & Sử dụng: Đến chi nhánh, quét mã QR tại cổng hoặc tại cửa kho để mở khóa tự động 24/7. Có camera AI giám sát và báo động chống trộm.

            🛡️ TIÊU CHUẨN AN TOÀN & BẢO HIỂM:
            - Bảo hiểm cháy nổ & rủi ro hàng hóa lên tới 50.000.000đ/kho.
            - Camera an ninh AI 360 độ, cảm biến nhiệt khói tự động, hệ thống PCCC tiêu chuẩn quốc gia.
            - Không cho phép lưu trữ: Hóa chất nguy hiểm, chất dễ cháy nổ, chất cấm, động vật sống hoặc thực phẩm tươi sống dễ ôi thiu.

            🎯 NGUYÊN TẮC TRẢ LỜI CỦA BẠN:
            1. Giọng điệu: Thân thiện, chu đáo, nhiệt tình, chuyên nghiệp và súc tích (khoảng 3 - 5 câu hoặc gạch đầu dòng rõ ràng).
            2. Hỗ trợ nút điều hướng: Sử dụng Markdown Link để tạo nút bấm điều hướng người dùng:
               - [Khám phá kho](/units)
               - [Đăng nhập](/login)
               - [Đăng ký tài khoản](/register)
               - [Quy định & Tiêu chuẩn](/terms)
               - [Cổng khách hàng](/customer)
            3. Nếu người dùng hỏi ngoài phạm vi Boxora (kho bãi, lưu trữ, check-in, thanh toán, hợp đồng), nhẹ nhàng chuyển hướng về các tiện ích của Boxora.
            Do not claim that Boxora has working IoT, SmartLock, QR auto-unlock, or remote lock control. The backend does not confirm physical device commands; describe physical lock state as unverified.
            """;

    public ChatbotServiceImpl(
            @Value("${gemini.api-keys:}") String configuredKeys,
            ObjectMapper objectMapper
    ) {
        this.objectMapper = objectMapper;
        this.restTemplate = new RestTemplate();
        if (configuredKeys != null && !configuredKeys.isBlank()) {
            this.apiKeys = Arrays.stream(configuredKeys.split(","))
                    .map(String::trim)
                    .filter(k -> k.length() > 10)
                    .toArray(String[]::new);
        } else {
            this.apiKeys = new String[0];
        }
        log.info("ChatbotServiceImpl initialized with {} Gemini API keys.", this.apiKeys.length);
    }

    @Override
    public ChatbotResponse chat(ChatbotRequest request) {
        if (apiKeys.length == 0) {
            log.error("Chatbot unavailable: no Gemini provider credentials are configured");
            return ChatbotResponse.builder()
                    .status("UNAVAILABLE")
                    .reply("Boxora AI is temporarily unavailable. Please try again later.")
                    .build();
        }

        String requestBodyJson = buildGeminiPayload(request);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        int totalKeys = apiKeys.length;
        int totalModels = models.length;
        int startKeyIdx = lastWorkingKeyIdx.get();
        int startModelIdx = lastWorkingModelIdx.get();

        for (int keyOffset = 0; keyOffset < totalKeys; keyOffset++) {
            int keyIndex = (startKeyIdx + keyOffset) % totalKeys;
            String apiKey = apiKeys[keyIndex];
            int modelStart = (keyOffset == 0) ? startModelIdx : 0;

            for (int modelOffset = 0; modelOffset < totalModels; modelOffset++) {
                int modelIndex = (modelStart + modelOffset) % totalModels;
                String model = models[modelIndex];
                String matrixKey = apiKey + "_" + model;

                Long cooldownUntil = keyCooldowns.get(matrixKey);
                if (cooldownUntil != null && System.currentTimeMillis() < cooldownUntil) {
                    continue;
                }

                String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", model, apiKey);

                try {
                    HttpEntity<String> entity = new HttpEntity<>(requestBodyJson, headers);
                    ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

                    if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                        String reply = extractReplyText(response.getBody());
                        if (reply != null && !reply.isBlank()) {
                            lastWorkingKeyIdx.set(keyIndex);
                            lastWorkingModelIdx.set(modelIndex);
                            return ChatbotResponse.builder()
                                    .status("AVAILABLE")
                                    .reply(reply)
                                    .build();
                        }
                    }
                } catch (HttpClientErrorException | HttpServerErrorException e) {
                    log.warn("Gemini provider request failed (model={}, status={})", model, e.getStatusCode());
                    keyCooldowns.put(matrixKey, System.currentTimeMillis() + 60000);
                } catch (Exception e) {
                    log.warn("Gemini provider request failed (model={}, errorType={})", model, e.getClass().getSimpleName());
                    keyCooldowns.put(matrixKey, System.currentTimeMillis() + 30000);
                }
            }
        }

        log.warn("Chatbot unavailable after retrying configured Gemini providers");
        return ChatbotResponse.builder()
                .status("UNAVAILABLE")
                .reply("Boxora AI is temporarily unavailable. Please try again later or browse storage options at /units.")
                .build();
    }

    private String buildGeminiPayload(ChatbotRequest request) {
        try {
            ObjectNode root = objectMapper.createObjectNode();

            // system_instruction
            ObjectNode sysInstruction = root.putObject("system_instruction");
            ArrayNode sysParts = sysInstruction.putArray("parts");
            sysParts.addObject().put("text", BOXORA_SYSTEM_PROMPT);

            // contents
            ArrayNode contentsArray = root.putArray("contents");

            if (request.getHistory() != null && !request.getHistory().isEmpty()) {
                // Keep only last 10 messages
                int start = Math.max(0, request.getHistory().size() - 10);
                for (int i = start; i < request.getHistory().size(); i++) {
                    ChatbotRequest.ChatMessageDto msg = request.getHistory().get(i);
                    String role = "assistant".equalsIgnoreCase(msg.getRole()) ? "model" : "user";
                    ObjectNode contentNode = contentsArray.addObject();
                    contentNode.put("role", role);
                    ArrayNode parts = contentNode.putArray("parts");
                    parts.addObject().put("text", msg.getContent());
                }
            }

            // Current message
            ObjectNode currentMsgNode = contentsArray.addObject();
            currentMsgNode.put("role", "user");
            ArrayNode curParts = currentMsgNode.putArray("parts");
            curParts.addObject().put("text", request.getMessage());

            // generationConfig
            ObjectNode genConfig = root.putObject("generationConfig");
            genConfig.put("temperature", 0.4);
            genConfig.put("maxOutputTokens", 800);
            genConfig.put("topP", 0.85);

            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            log.error("Failed to build Gemini payload: {}", e.getMessage(), e);
            throw new RuntimeException("Lỗi cấu trúc dữ liệu gửi AI", e);
        }
    }

    private String extractReplyText(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && !parts.isEmpty()) {
                    return parts.get(0).path("text").asText();
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse Gemini response: {}", e.getMessage(), e);
        }
        return null;
    }
}
