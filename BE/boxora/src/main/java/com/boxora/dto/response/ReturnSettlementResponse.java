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
public class ReturnSettlementResponse {

    private UUID handoverRecordId;
    private UUID bookingId;
    private String bookingCode;
    private String unitCode;
    private String customerName;
    private UUID staffId;
    private String staffName;

    /** Tiền cọc đã nộp ban đầu */
    private BigDecimal depositPaid;

    /** Chi phí sửa chữa hư hại */
    private BigDecimal damageFee;

    /** Phí vệ sinh kho */
    private BigDecimal cleaningFee;

    /** Phí mất thẻ từ / khóa */
    private BigDecimal lostCardFee;

    /** Công nợ quá hạn / trễ hạn */
    private BigDecimal overdueDebt;

    /** Tổng các khoản khấu trừ */
    private BigDecimal totalDeduction;

    /** Số tiền thực hoàn trả cho khách (depositPaid - totalDeduction) */
    private BigDecimal netRefundAmount;

    /** Trạng thái duyệt hoàn tiền: AUTO_REFUND_APPROVED hoặc PENDING_ACCOUNTING_REVIEW */
    private String reviewStatus;

    /** Cam kết thời gian hoàn tiền (SLA số ngày) */
    private Integer depositRefundSlaDays;

    /** Mã giao dịch hoàn tiền nếu đã sinh */
    private String refundTransactionId;

    /** Đạt toàn bộ 5/5 tiêu chuẩn hiện trường */
    private boolean checklistAllPassed;

    /** Tóm tắt 5 điểm kiểm tra hiện trường */
    private String checklistSummary;

    /** Số lượng ảnh bằng chứng hiện trường */
    private int evidencePhotoCount;

    /** Danh sách URL ảnh bằng chứng */
    private List<String> evidencePhotos;

    /** Thời điểm ghi nhận */
    private LocalDateTime recordedAt;

    /** Ghi chú */
    private String notes;
}

