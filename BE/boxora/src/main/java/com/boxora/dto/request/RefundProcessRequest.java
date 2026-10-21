package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundProcessRequest {

    @NotBlank(message = "Vui lòng nhập mã giao dịch ngân hàng của khoản hoàn tiền")
    private String transactionReference;

    private String processNotes;
}
