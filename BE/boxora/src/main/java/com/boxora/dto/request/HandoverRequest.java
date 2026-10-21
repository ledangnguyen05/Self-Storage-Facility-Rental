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
    @NotNull(message = "Thiếu mã đơn đặt kho")
    private UUID bookingId;

    private UUID staffId;

    private String recordType; // "CHECK_IN" or "RETURN"

    /** CCCD hoặc PASSPORT; mặc định lấy loại giấy tờ đã đối chiếu trên đơn */
    private String idCardType;

    private String idCardNumber;

    /** Xác nhận đã đối chiếu CCCD/hộ chiếu gốc tại quầy */
    private Boolean identityVerified;

    /** Xác nhận đã thu/đối soát tiền thuê tháng đầu */
    private Boolean firstMonthRentConfirmed;

    /** Xác nhận hợp đồng điện tử đã được ký hoàn tất */
    private Boolean contractConfirmed;

    private String rfidCardNumber;

    private String accessPin;

    private BigDecimal depositSettled;

    private BigDecimal deductionAmount;

    // --- BR-RULE-013: 5 CHECKLIST ITEMS TIÊU CHUẨN HIỆN TRẠNG KHO ---
    /** 1. Tình trạng cửa cuốn (đóng mở êm, không móp méo, ray dẫn tốt) */
    private Boolean doorConditionPassed;

    /** 2. Vệ sinh kho & sàn (đã dọn sạch rác, không ẩm ướt) */
    private Boolean cleanlinessPassed;

    /** 3. Ổ khóa Smart Lock (cảm biến nhạy, pin tốt, khóa chắc chắn) */
    private Boolean smartLockPassed;

    /** 4. Cảm biến nhiệt / ẩm (thông số chuẩn, hoạt động bình thường) */
    private Boolean sensorPassed;

    /** 5. Tường vách / kết cấu kho (không móp vách, không bong tróc, nguyên vẹn) */
    private Boolean wallStructurePassed;

    // --- BR-RULE-014: CHI PHÍ KHẤU TRỪ CHI TIẾT ---
    /** Chi phí sửa chữa hư hại cửa/vách/ổ khóa */
    private BigDecimal damageFee;

    /** Phí dịch vụ vệ sinh nếu khách chưa dọn kho */
    private BigDecimal cleaningFee;

    /** Phí làm mất thẻ từ RFID hoặc chìa khóa cơ */
    private BigDecimal lostCardFee;

    /** Công nợ quá hạn / tiền phạt trễ hạn nếu có */
    private BigDecimal overdueDebt;

    /** Chi tiết mô tả lỗi hư hại / hiện trường (ghi chú này không tự đưa kho vào bảo trì: chỉ phí hư hại, phí vệ sinh hoặc hạng mục không đạt mới làm điều đó) */
    private String damageNotes;

    /** Lý do khấu trừ cọc. Bắt buộc khi khấu trừ vượt phí trễ hạn theo chính sách; nếu để trống sẽ dùng damageNotes. */
    private String deductionReason;

    /** Phương thức hoàn tiền: VNPAY_REFUND, BANK_TRANSFER hoặc CASH */
    private String refundMethod;

    /** Thông tin tài khoản nhận hoàn cọc (bắt buộc khi refundMethod = BANK_TRANSFER) */
    private String refundBankName;

    private String refundBankAccountNumber;

    private String refundBankAccountName;

    /** Đánh dấu chuyển kế toán duyệt chi */
    private Boolean requiresAccountingReview;

    /** Danh sách URL ảnh chụp hiện trường nghiệm thu */
    private List<String> evidencePhotos;

    private String unitCondition;

    private String notes;
}
