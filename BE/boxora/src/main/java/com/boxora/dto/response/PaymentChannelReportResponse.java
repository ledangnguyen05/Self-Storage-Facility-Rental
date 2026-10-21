package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Phân bổ giao dịch thu tiền (PAID) theo kênh thanh toán trong kỳ báo cáo. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentChannelReportResponse {
    private LocalDate fromDate;
    private LocalDate toDate;
    private long totalCount;
    private BigDecimal totalAmount;
    /** Sắp xếp theo số giao dịch giảm dần. */
    private List<PaymentChannelItemResponse> channels;
}
