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
    private String unitCode;
    private String facilityName;

    // ==========================================
    // 4 ĐIỀU KIỆN TIÊN QUYẾT BÀN GIAO (BR-RULE-005)
    // ==========================================

    /** Điều kiện 1: Đủ tiền cọc (Full deposit) */
    private boolean depositSatisfied;
    private BigDecimal depositPaid;
    private BigDecimal requiredDeposit;

    /** Điều kiện 2: Đủ tiền thuê tháng đầu (First rental payment) */
    private boolean firstMonthRentSatisfied;
    private BigDecimal firstMonthRentPaid;
    private BigDecimal requiredFirstMonthRent;

    /** Điều kiện 3: Hợp đồng điện tử đã ký qua OTP / DocuSeal (Signed e-contract) */
    private boolean contractSigned;
    private String contractCode;
    private String contractStatus;

    /** Điều kiện 4: Đã xác minh CCCD / giấy tờ tùy thân gốc (Original identity verification) */
    private boolean identityVerified;
    private String idCardNumber;

    // ==========================================
    // TỔNG KẾT
    // ==========================================

    /** Đủ điều kiện để thực hiện bàn giao kho hay không (Phải thỏa mãn đồng thời cả 4 điều kiện) */
    private boolean eligibleForCheckIn;

    /** Danh sách các điều kiện còn thiếu (để hiển thị cảnh báo cho nhân viên quầy) */
    private List<String> missingPrerequisites;
}

