package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class ContractOtpVerifyRequest {

    @NotBlank
    @Pattern(regexp = "\\d{6}", message = "OTP must contain exactly six digits")
    private String otp;
}
