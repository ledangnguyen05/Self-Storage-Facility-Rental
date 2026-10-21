package com.boxora.dto.request;

import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingCancelRequest {

    @Size(max = 500, message = "Lý do hủy đơn không được vượt quá 500 ký tự")
    private String cancellationReason;

    @Size(max = 100, message = "Tên ngân hàng không được vượt quá 100 ký tự")
    private String bankName;

    @jakarta.validation.constraints.Pattern(regexp = "^[0-9 ]{0,24}$", message = "Số tài khoản chỉ gồm 6 đến 20 chữ số")
    private String bankAccountNumber;

    @Size(max = 100, message = "Tên chủ tài khoản không được vượt quá 100 ký tự")
    private String bankAccountName;
}

