package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketAdminPayoutRequest {
    @NotBlank(message = "Mã giao dịch chuyển khoản ngân hàng không được để trống")
    private String transferTransactionRef;

    @NotBlank(message = "Ảnh chụp màn hình biên lai chuyển tiền không được để trống")
    private String transferProofUrl;

    private String adminNotes;
}
