package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnSettlementPreviewResponse {

    private UUID bookingId;
    private String bookingCode;
    private String customerName;
    private String customerPhone;
    private String unitCode;
    private String facilityName;
    private String contractCode;
    private String contractStatus;

    /** Ngày hết hạn theo hợp đồng */
    private LocalDate rentalEndDate;

    /** Ngày thực hiện trả kho */
    private LocalDate actualReturnDate;

    /** Trạng thái hiện tại của đơn (ACTIVE, CHECKOUT_REQUESTED, INSPECTED, OVERDUE...) */
    private String bookingStatus;

    /** Số ngày quá hạn nếu có */
    private long overdueDays;

    /** Số ngày ân hạn được miễn phí trước khi tính phí trễ hạn */
    private Integer overdueGraceDays;

    /** Tiền đặt cọc ban đầu của khách */
    private BigDecimal depositPaid;

    /** Phí phạt mỗi ngày nếu quá hạn */
    private BigDecimal dailyLateFee;

    /** Tiền phạt trễ hạn ước tính */
    private BigDecimal calculatedOverdueLateFee;

    /** Số ngày cam kết hoàn tiền cọc (SLA) */
    private Integer depositRefundSlaDays;

    /** Gợi ý trạng thái duyệt cọc: AUTO_REFUND_APPROVED hoặc PENDING_ACCOUNTING_REVIEW */
    private String recommendedReviewStatus;

    /** 5 tiêu chí thẩm định hiện trường theo BR-RULE-013 */
    private List<String> checklistStandardItems;
}

