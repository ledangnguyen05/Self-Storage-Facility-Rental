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

    /** Phí sửa cửa */
    private BigDecimal doorFee;

    /** Phí sửa SmartLock */
    private BigDecimal smartLockFee;
    private String smartLockIssueType;

    /** Phí sửa kết cấu vách/sàn/trần */
    private BigDecimal wallStructureFee;

    /** Công nợ quá hạn / trễ hạn */
    private BigDecimal overdueDebt;

    /** Tổng các khoản khấu trừ */
    private BigDecimal totalDeduction;

    /** Tổng chi phí khấu trừ đã duyệt */
    private BigDecimal approvedDeductions;

    /** Số tiền thực hoàn trả cho khách (depositPaid - totalDeduction) (không âm) */
    private BigDecimal netRefundAmount;

    /** Khoản bồi thường bổ sung còn phải thu khi chi phí > cọc */
    private BigDecimal additionalAmountDue;

    /** Trạng thái duyệt hoàn tiền: AUTO_REFUND_APPROVED hoặc PENDING_ACCOUNTING_REVIEW */
    private String reviewStatus;
    private String approvalStatus;
    private String approverName;
    private LocalDateTime approvedAt;
    private String approvalNotes;

    /** Trạng thái thanh toán bổ sung */
    private String additionalPaymentStatus;
    private String additionalPaymentTxnRef;

    /** Trạng thái hoàn tiền */
    private String refundStatus;
    private String refundTransactionId;
    private String transferProofUrl;

    /** Cam kết thời gian hoàn tiền (SLA số ngày) */
    private Integer depositRefundSlaDays;

    /** Đạt toàn bộ 7/7 tiêu chuẩn hiện trường */
    private boolean checklistAllPassed;

    /** Tóm tắt kiểm tra hiện trường */
    private String checklistSummary;

    /** Chi tiết 7 tiêu chuẩn */
    private Boolean doorConditionPassed;
    private Boolean cleanlinessPassed;
    private Boolean wallStructurePassed;
    private Boolean smartLockPassed;
    private Boolean assetsClearedPassed;
    private Boolean sensorPassed;

    /** Bàn giao vật lý & truy cập */
    private Boolean unitReturnedPhysically;
    private LocalDateTime returnedAt;
    private Boolean accessRevoked;
    private LocalDateTime accessRevokedAt;
    private String postReturnUnitStatus;

    /** Task 16: Quyết toán, khiếu nại, giải quyết khiếu nại và thông tin ngân hàng */
    private Integer settlementVersion;
    private Boolean settlementConfirmed;
    private LocalDateTime settlementConfirmedAt;
    private String settlementConfirmedByName;
    private String customerDecision;
    private LocalDateTime customerDecisionAt;
    private String disputeReason;
    private String disputeEvidenceUrls;
    private LocalDateTime disputeResolvedAt;
    private String disputeResolvedByName;
    private String disputeResolutionNote;
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountName;
    private UUID refundRequestId;

    /** Số lượng ảnh bằng chứng hiện trường */
    private int evidencePhotoCount;

    /** Danh sách URL ảnh bằng chứng */
    private List<String> evidencePhotos;

    /** Thời điểm ghi nhận */
    private LocalDateTime recordedAt;

    /** Ghi chú */
    private String notes;
}
