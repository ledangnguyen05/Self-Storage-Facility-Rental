package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HandoverResponse {
    private UUID id;
    private UUID bookingId;
    private String bookingCode;
    private String unitCode;
    private String customerName;
    private UUID staffId;
    private String staffName;
    private String recordType;
    private String unitCondition;

    // --- Bổ sung chi tiết quyết toán trả kho (Return & Deposit Settlement) ---
    private BigDecimal depositSettled;
    private BigDecimal deductionAmount;
    private BigDecimal refundAmount;
    private String reviewStatus;
    private Integer depositRefundSlaDays;
    private String refundTransactionId;
    private Boolean checklistAllPassed;
    private String checklistSummary;
    private List<String> evidencePhotos;

    private String notes;
    private LocalDateTime recordedAt;

    private String rfidCardNumber;

    // --- Cấp quyền truy cập SmartLock phát hành bởi máy chủ (chỉ có trong phản hồi check-in, không bao giờ trong lịch sử) ---
    private String accessPin;
    private String qrAccessToken;

    // --- Kết quả gửi thông tin bàn giao (chỉ có trong phản hồi check-in) ---
    /** true chỉ khi máy chủ email đã nhận thư gửi tới email trong hồ sơ khách */
    private Boolean emailSent;
    /** true khi thư PIN đã được đưa vào hàng gửi nền (gửi sau khi bàn giao được lưu); kết quả cuối cùng nằm trong nhật ký máy chủ */
    private Boolean emailQueued;
    private String emailError;
    private Boolean inAppNotificationSent;
}
