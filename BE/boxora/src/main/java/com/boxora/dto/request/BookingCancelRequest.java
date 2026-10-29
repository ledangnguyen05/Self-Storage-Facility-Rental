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

    @Size(max = 50, message = "Số tài khoản không được vượt quá 50 ký tự")
    private String bankAccountNumber;

    @Size(max = 100, message = "Tên chủ tài khoản không được vượt quá 100 ký tự")
    private String bankAccountName;

    private String customerEmail;
}
