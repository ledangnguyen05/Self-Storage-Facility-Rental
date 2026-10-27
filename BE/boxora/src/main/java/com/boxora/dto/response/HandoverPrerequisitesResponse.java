package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HandoverPrerequisitesResponse {

    private UUID bookingId;
    private String bookingCode;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private String unitCode;
    private String unitTypeName;
    private Double areaSqMeters;
    private String facilityName;

    // ==========================================
    // 4 ĐIỀU KIỆN TIÊN QUYẾT BÀN GIAO (BR-RULE-005)
    // ==========================================

    /** Điều kiện 1: Đủ tiền cọc (Full deposit) */
    private boolean depositSatisfied;
    private BigDecimal depositPaid;
    private BigDecimal requiredDeposit;
    private BigDecimal depositRemaining;

    /** Điều kiện 2: Đủ tiền thuê tháng đầu (First rental payment) */
    private boolean firstMonthRentSatisfied;
    private BigDecimal firstMonthRentPaid;
    private BigDecimal requiredFirstMonthRent;
    private BigDecimal firstMonthRentRemaining;

    /** Điều kiện 3: Hợp đồng thuê kho (Electronic OTP/DocuSeal or Paper at Facility) */
    private boolean contractSigned;
    private String contractCode;
    private String contractStatus;
    private String contractSigningMethod;
    private String contractVerificationStatus;
    private String signedDocumentUrl;
    private java.time.LocalDateTime contractSignedAt;
    private String paperContractUrl;
    private String paperOriginalLocation;
    private String paperVerifiedByName;
    private java.time.LocalDateTime paperVerifiedAt;

    /** Điều kiện 4: Đã xác minh CCCD / giấy tờ tùy thân gốc (Original identity verification) */
    private boolean identityVerified;
    private String idCardType;
    private String idCardNumber;
    private String registeredIdCardNumber;
    private String registeredIdCardType;
    private String identityVerifiedByName;
    private java.time.LocalDateTime identityVerifiedAt;

    // ==========================================
    // THỜI ĐIỂM CHECK-IN HỢP LỆ (LỊCH HẸN NHẬN KHO)
    // ==========================================
    private boolean checkInTimeMet;
    private String checkInTimeStatus; // BEFORE_DATE | BEFORE_TIME | ON_TIME | LATE
    private String checkInTimeMessage;
    private java.time.LocalDateTime expectedCheckInAt;

    // ==========================================
    // TỔNG KẾT & TIẾN TRÌNH
    // ==========================================

    /** Cho phép chuyển sang bước Nghiệm thu hiện trường khi thỏa mãn cả 4 điều kiện đối soát */
    private boolean eligibleForInspection;

    /** Đủ điều kiện để thực hiện bàn giao kho hay không (tương thích ngược) */
    private boolean eligibleForCheckIn;

    /** Danh sách các điều kiện còn thiếu chi tiết */
    private List<String> missingPrerequisites;

    /** Danh sách các khoản thanh toán của booking này để quầy kiểm tra */
    private List<PaymentResponse> paymentHistory;
}


