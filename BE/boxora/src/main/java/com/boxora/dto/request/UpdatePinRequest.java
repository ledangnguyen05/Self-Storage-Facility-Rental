package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdatePinRequest {

    @NotBlank(message = "Mã PIN không được để trống")
    @Pattern(regexp = "^\\d{6}$", message = "Mã PIN phải bao gồm chính xác 6 chữ số")
    private String newPin;
}
