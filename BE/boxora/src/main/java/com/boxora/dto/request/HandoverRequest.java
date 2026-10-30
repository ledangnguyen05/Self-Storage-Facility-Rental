package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HandoverRequest {
    private UUID bookingId;

    /** Mã kho khách chọn tại cơ sở; được xác nhận và gắn vào booking khi bàn giao hoàn tất. */
    private String requestedUnitCode;

    private UUID staffId;

    private String recordType; // "CHECK_IN" or "RETURN"

    private String idCardNumber;

    /** Xác nhận đã đối chiếu CCCD/hộ chiếu gốc tại quầy */
    private Boolean identityVerified;

    /** Xác nhận đã thu/đối soát tiền thuê tháng đầu */
    private Boolean firstMonthRentConfirmed;

    /** Xác nhận hợp đồng điện tử đã được ký hoàn tất */
    private Boolean contractConfirmed;

    /** Xác nhận cho phép tiếp nhận kho sớm hơn lịch hẹn đối với trường hợp ngoại lệ hợp lệ */
    private Boolean earlyCheckInConfirmed;

    /** Lý do tiếp nhận kho sớm (lưu audit trail) */
    private String earlyCheckInReason;

    private String rfidCardNumber;

    private String accessPin;

    private BigDecimal depositSettled;

    private BigDecimal deductionAmount;

    // --- BR-RULE-013: 7 CHECKLIST ITEMS TIÊU CHUẨN HIỆN TRẠNG TRẢ KHO ---
    /** 1. Tình trạng cửa cuốn (đóng mở êm, không móp méo, ray dẫn tốt) */
    private Boolean doorConditionPassed;
    private BigDecimal doorFee;
    private String doorNotes;

    /** 2. Vệ sinh kho & sàn (đã dọn sạch rác, không ẩm ướt) */
    private Boolean cleanlinessPassed;
    private BigDecimal cleaningFee;
    private String cleanlinessNotes;

    /** 3. Tường vách / kết cấu kho (không móp vách, không bong tróc, nguyên vẹn) */
    private Boolean wallStructurePassed;
    private BigDecimal wallStructureFee;
    private String wallStructureNotes;

    /** 4. Ổ khóa Smart Lock IoT (cảm biến nhạy, pin tốt, khóa chắc chắn) */
    private Boolean smartLockPassed;
    private BigDecimal smartLockFee;
    private String smartLockNotes;
    /** Loại nguyên nhân lỗi Smart Lock: CUSTOMER_FAULT, NORMAL_WEAR, DEVICE_ERROR, CONNECTION_ERROR, PENDING_VERIFICATION */
    private String smartLockIssueType;

    /** 5. Xác nhận kho đã lấy hết đồ đạc & giải phóng tài sản */
    private Boolean assetsClearedPassed;
    private String assetsClearedNotes;

    /** 6. Ảnh bằng chứng hiện trường (tối thiểu 2 ảnh chụp thực tế) */
    private List<String> evidencePhotos;

    /** 7. Cảm biến nhiệt / ẩm môi trường Boxora IoT */
    private Boolean sensorPassed;
    private String sensorNotes;

    // --- BR-RULE-014: CHI PHÍ KHẤU TRỪ CHI TIẾT ---
    /** Chi phí sửa chữa hư hại cửa/vách/ổ khóa */
    private BigDecimal damageFee;

    /** Phí làm mất thẻ từ RFID hoặc chìa khóa cơ */
    private BigDecimal lostCardFee;

    /** Công nợ quá hạn / tiền phạt trễ hạn nếu có */
    private BigDecimal overdueDebt;

    /** Chi tiết mô tả lỗi hư hại / hiện trường */
    private String damageNotes;

    /** Lưu biên bản dưới dạng bản nháp (DRAFT) chưa chốt */
    private Boolean isDraft;

    /** Lịch hẹn kiểm tra hiện trường */
    private java.time.LocalDateTime scheduledInspectionAt;
    private String rescheduleReason;

    /** Phê duyệt khấu trừ */
    private BigDecimal approvedAmount;
    private BigDecimal approvedDeductionAmount;
    private String approvalAction;
    private String approvalNotes;
    private Boolean approved;

    /** Ghi nhận khiếu nại / tranh chấp từ khách hàng */
    private String disputeReason;

    /** Thu tiền bồi thường bổ sung khi chi phí vượt cọc */
    private String additionalPaymentMethod;
    private String additionalPaymentTxnRef;

    /** Phương thức hoàn tiền: VNPAY_REFUND hoặc BANK_TRANSFER */
    private String refundMethod;
    private String refundTxnRef;

    /** Đánh dấu chuyển kế toán duyệt chi */
    private Boolean requiresAccountingReview;

    private String unitCondition;

    private String notes;
}
