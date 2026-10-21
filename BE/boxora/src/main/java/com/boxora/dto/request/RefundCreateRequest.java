package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundCreateRequest {

    private UUID bookingId;

    private UUID contractId;

    /** Ignored: the refundable amount is computed by the server from the collected deposit. */
    private BigDecimal requestedAmount;

    /** Ignored: deductions are decided by the cancellation policy or the return settlement. */
    private BigDecimal deductionAmount;

    /** Optional: the customer can provide the bank account later (PUT /refunds/{id}/bank-account). */
    @Size(max = 100, message = "Tên ngân hàng tối đa 100 ký tự")
    private String bankName;

    @Size(max = 24, message = "Số tài khoản tối đa 20 chữ số")
    private String bankAccountNumber;

    @Size(max = 100, message = "Tên chủ tài khoản tối đa 100 ký tự")
    private String bankAccountName;

    @NotBlank(message = "Vui lòng nhập lý do hoàn tiền")
    @Size(max = 500, message = "Lý do hoàn tiền tối đa 500 ký tự")
    private String reason;
}
