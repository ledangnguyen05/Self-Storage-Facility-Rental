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
public class ReturnPayoutRequest {

    @NotBlank(message = "Mã giao dịch ngân hàng không được để trống")
    private String transactionReference;

    private String transferProofUrl;
    private String processNotes;
}
