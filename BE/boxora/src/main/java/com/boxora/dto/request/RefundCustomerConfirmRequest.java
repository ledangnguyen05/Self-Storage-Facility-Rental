package com.boxora.dto.request;

import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundCustomerConfirmRequest {

    @Size(max = 500, message = "Ghi chú xác nhận không được quá 500 ký tự")
    private String confirmationNotes;
}
