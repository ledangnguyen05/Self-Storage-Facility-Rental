package com.boxora.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Body of POST /payments/contracts/{id}/outstanding/vnpay. The amount itself is computed by the server. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutstandingPaymentRequest {

    /** Monthly periods of the term (not due yet) to prepay together with what is due now. */
    @Min(value = 0, message = "Số tháng trả trước không hợp lệ")
    @Max(value = 60, message = "Số tháng trả trước không hợp lệ")
    private Integer upcomingMonths;
}
