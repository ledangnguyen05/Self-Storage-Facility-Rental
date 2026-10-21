package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Một khoản nợ quá hạn. Số tiền đã trừ các khoản khách đã thanh toán cho kỳ quá hạn
 * ({@code paidAmount}); {@code totalDebt = unpaidRent + totalLateFee} là số còn phải thu.
 * Các trường thông tin khách/cơ sở là {@code null} khi dữ liệu gốc không có, không bao giờ là giá trị giả.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueDebtItemResponse {
    private UUID contractId;
    private String contractCode;
    private UUID bookingId;
    private String bookingCode;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String customerEmail;
    private UUID unitId;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private LocalDate startDate;
    private LocalDate dueDate;
    private long daysOverdue;
    private BigDecimal unpaidRent;
    private BigDecimal dailyLateFee;
    private BigDecimal totalLateFee;
    /** Tổng tiền khách đã thanh toán cho kỳ quá hạn (đã được trừ khỏi unpaidRent và totalLateFee). */
    private BigDecimal paidAmount;
    private BigDecimal totalDebt;
    private String overdueStage; // GRACE_PERIOD, WARNING, ACCESS_BLOCKED, ELIGIBLE_FOR_SEALING
    /** Trạng thái khóa thực tế: NORMAL, WARNING, TEMP_LOCKED (đã thu hồi PIN hoặc khóa kho), SEALED (đã niêm phong). */
    private String smartLockStatus;
    /** Hợp đồng ở trạng thái nào (RentalContractStatus), null với khoản chưa có hợp đồng. */
    private String contractStatus;
    private String unitStatus;
    /** Kho đang bị khóa do quá hạn (kho OVERDUE_LOCKED, hợp đồng OVERDUE_LOCKED hoặc mã PIN/QR đã bị thu hồi). */
    private boolean locked;
}
