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

            🏢 THÔNG TIN VỀ HỆ THỐNG BOXORA:
            - Boxora là nền tảng tiên phong tại Việt Nam cung cấp dịch vụ cho thuê kho mini tự quản, kho cá nhân, kho gia đình và kho thương mại điện tử tích hợp công nghệ Smart Lock (mã PIN bảo mật cá nhân), camera giám sát AI 24/7 và hệ thống kiểm soát môi trường nhiệt ẩm tiêu chuẩn.
            - Khách hàng ký hợp đồng điện tử và nhận mã PIN mở khóa cửa kho trực tuyến ngay trên hệ thống.

            📍 DANH SÁCH 4 CHI NHÁNH CHÍNH THỨC TẠI TP. HỒ CHÍ MINH:
            1. Boxora Quận 1 (Mã: HCM-D1): 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM. Hotline: 0901234567 | Email: boxoradistrict1@gmail.com. Giờ mở cửa: 08:00 - 20:00 hàng ngày.
            2. Boxora Quận 7 (Mã: HCM-D7): 456 Nguyễn Hữu Thọ, Phường Tân Hưng, Quận 7, TP.HCM. Hotline: 0902345678 | Email: boxoradistrict7@gmail.com. Giờ mở cửa: 08:00 - 20:00 hàng ngày.
            3. Boxora Thủ Đức (Mã: HCM-TD): 789 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM. Hotline: 0903456789 | Email: boxorathuduc@gmail.com. Giờ mở cửa: 08:00 - 20:00 hàng ngày.
            4. Boxora Tân Bình Mega Hub (Mã: HCM-TB): 102 Trường Sơn, Phường 2, Quận Tân Bình, TP.HCM. Hotline: 0904567890 | Email: tanbinh@boxora.vn. Giờ mở cửa: 08:00 - 21:00 hàng ngày.

            📦 BẢNG GIÁ VÀ CÁC LOẠI KHO THỰC TẾ:
            1. Mini (tủ cá nhân):
               - Kích thước: 1.0m x 1.0m x 1.2m | Diện tích: 1.0 m² | Thể tích: 1.2 m³.
               - Giá thuê: 450.000đ/tháng | Tiền cọc: 450.000đ.
               - Phù hợp: Balo, vali du lịch, hồ sơ tài liệu công chứng, đồ công nghệ, thiết bị nhỏ.
            2. Vừa (phòng studio nhỏ):
               - Kích thước: 1.5m x 2.0m x 2.6m | Diện tích: 3.0 m² | Thể tích: 7.8 m³.
               - Giá thuê: 1.250.000đ/tháng | Tiền cọc: 1.250.000đ.
               - Phù hợp: Đồ dùng sinh viên, cá nhân dọn phòng trọ, xe đạp, quạt, bàn ghế xếp, vali lớn.
            3. Tiêu chuẩn (căn một phòng ngủ):
               - Kích thước: 2.0m x 3.0m x 2.8m | Diện tích: 6.0 m² | Thể tích: 16.8 m³.
               - Giá thuê: 2.400.000đ/tháng | Tiền cọc: 2.400.000đ.
               - Phù hợp: Toàn bộ nội thất căn hộ 1-2 phòng ngủ khi chuyển nhà, sửa nhà (giường, nệm, tủ, sofa, máy giặt, tủ lạnh).
            4. Kho lạnh (kiểm soát nhiệt độ 18°C - 22°C):
               - Kích thước: 2.0m x 2.5m x 2.8m | Diện tích: 5.0 m² | Thể tích: 14.0 m³.
               - Giá thuê: 3.200.000đ/tháng | Tiền cọc: 3.200.000đ.
               - Phù hợp: Rượu vang cao cấp, mỹ phẩm, đồ da hàng hiệu, linh kiện điện tử nhạy cảm, dược phẩm, hồ sơ chống ẩm mốc.
            5. Rất lớn (văn phòng thương mại):
               - Kích thước: 3.0m x 4.0m x 3.0m | Diện tích: 12.0 m² | Thể tích: 36.0 m³.
               - Giá thuê: 4.800.000đ/tháng | Tiền cọc: 4.800.000đ.
               - Phù hợp: Hàng hóa kinh doanh thương mại điện tử, livestream, thiết bị sự kiện, vật tư công ty, hàng pallet.

            💳 CHÍNH SÁCH THANH TOÁN, CỌC & GIỮ CHỖ MỚI NHẤT:
            - Thanh toán 100% trực tuyến: Hệ thống thanh toán online 100% qua Cổng VNPay (quét mã VietQR, thẻ ATM nội địa, thẻ quốc tế Visa/MasterCard). Boxora hiện không thu tiền mặt tại quầy để đảm bảo minh bạch và tự động hóa.
            - Tiền đặt cọc: Bằng 100% tiền thuê 1 tháng (ví dụ kho 450.000đ thì cọc 450.000đ). Cọc được hoàn lại 100% khi kết thúc hợp đồng và bàn giao kho nguyên vẹn.
            - Thời hạn thuê tối thiểu: 1 tháng.
            - Thời hạn giữ chỗ (Hold booking): Giữ chỗ thanh toán cọc trong vòng 1 giờ; ngày nhận kho có thể đặt trước tối đa 14 ngày.
            - Chính sách hủy & hoàn cọc:
              + Hủy trước 24 giờ so với giờ check-in hẹn: Hoàn 100% tiền cọc và tiền thuê đã trả.
              + Hủy trong vòng 48 giờ: Hoàn 70% tiền cọc.
              + Hủy muộn hơn hoặc bỏ ca: Mất tiền cọc theo quy định.
            - Hoàn trả cọc khi trả kho (Return): Tiền cọc được hoàn trả trong vòng 5 ngày làm việc (SLA 5 ngày) sau khi nhân viên kiểm tra kho không hư hại nợ quá hạn.
            - Phí phạt trễ hạn & Xử lý nợ: Ân hạn nợ 1 ngày; phí trễ hạn là 50.000đ/ngày. Sau 3 ngày nợ quá hạn sẽ tạm khóa mã PIN mở kho. Sau 7 ngày nợ quá hạn sẽ tiến hành niêm phong kho vật lý theo biên bản.

            🚀 QUY TRÌNH THUÊ VÀ SỬ DỤNG KHO:
            1. Đặt kho online: Chọn chi nhánh, loại kho, ngày bắt đầu thuê tại trang [Khám phá kho](/units).
            2. Thanh toán trực tuyến: Thanh toán tiền thuê và cọc qua VNPay (VietQR/Thẻ).
            3. Nhận Mã PIN & Hợp đồng: Ký hợp đồng điện tử và nhận mã PIN truy cập SmartLock ngay tại [Cổng Khách Hàng](/customer).
            4. Check-in thực tế: Đến chi nhánh theo lịch hẹn, nhân viên hỗ trợ đối soát CCCD/Hộ chiếu và bàn giao kho (Handover Check-in). Khách hàng sử dụng mã PIN để ra vào kho tự quản.
            5. Gia hạn hoặc Trả kho: Thực hiện thao tác trực tuyến trên [Cổng Khách Hàng](/customer) (cửa sổ gia hạn mở trước 3 ngày trước khi hết hạn).

            🛡️ AN TOÀN & BẢO HIỂM:
            - Bảo hiểm hàng hóa tiêu chuẩn phòng cháy nổ, camera an ninh AI 24/7, cảm biến khói nhiệt tự động, hệ thống PCCC nghiệm thu chuẩn nhà nước.
            - Danh mục cấm lưu trữ: Chất dễ cháy nổ, pháo hoa, xăng dầu, hóa chất độc hại, hàng quốc cấm, vũ khí, động vật sống hoặc thực phẩm tươi sống dễ ôi thiu bốc mùi.

            🎯 NGUYÊN TẮC TRẢ LỜI CỦA BẠN:
            1. Giọng điệu: Thân thiện, chu đáo, nhiệt tình, chuyên nghiệp, chính xác tuyệt đối theo các thông số và bảng giá nêu trên.
            2. Câu trả lời súc tích, có gạch đầu dòng rõ ràng, không lan man dài dòng.
            3. Luôn đính kèm đường link điều hướng phù hợp dạng Markdown Link:
               - [Khám phá & Đặt kho](/units)
               - [Cổng khách hàng (Xem mã PIN & Quản lý kho)](/customer)
               - [Đăng nhập](/login)
               - [Đăng ký tài khoản](/register)
               - [Quy định & Tiêu chuẩn](/terms)
               - [Trung tâm hỗ trợ](/support)
            4. Không khẳng định rằng Boxora có thể điều khiển mở khóa vật lý từ xa qua internet ngoài phạm vi mã PIN / Smart Key khách hàng tự thao tác.
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

                HttpHeaders reqHeaders = new HttpHeaders();
                reqHeaders.setContentType(MediaType.APPLICATION_JSON);
                reqHeaders.set("x-goog-api-key", apiKey);

                String url = String.format("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", model);

                try {
                    HttpEntity<String> entity = new HttpEntity<>(requestBodyJson, reqHeaders);
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
