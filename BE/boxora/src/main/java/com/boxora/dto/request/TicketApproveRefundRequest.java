package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketApproveRefundRequest {
    @NotNull(message = "Số tiền hoàn duyệt không được để trống")
    @Positive(message = "Số tiền hoàn duyệt phải lớn hơn 0")
    private BigDecimal refundAmount;

    private String note;
}
