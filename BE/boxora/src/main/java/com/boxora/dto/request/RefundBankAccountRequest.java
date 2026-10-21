package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Bank account that receives a refund (PUT /refunds/{id}/bank-account, cancellation with refund). */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundBankAccountRequest {

    @NotBlank(message = "Vui lòng nhập tên ngân hàng")
    @Size(min = 2, max = 100, message = "Tên ngân hàng từ 2 đến 100 ký tự")
    private String bankName;

    @NotBlank(message = "Vui lòng nhập số tài khoản")
    @Pattern(regexp = "^[0-9 ]{6,24}$", message = "Số tài khoản chỉ gồm 6 đến 20 chữ số")
    private String bankAccountNumber;

    @NotBlank(message = "Vui lòng nhập tên chủ tài khoản")
    @Size(min = 2, max = 100, message = "Tên chủ tài khoản từ 2 đến 100 ký tự")
    private String bankAccountName;
}
