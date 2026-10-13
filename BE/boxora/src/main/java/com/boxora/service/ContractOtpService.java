package com.boxora.service;

import com.boxora.dto.response.ContractOtpResponse;

import java.util.UUID;

public interface ContractOtpService {
    ContractOtpResponse sendOtp(UUID contractId);

    ContractOtpResponse resendOtp(UUID contractId);

    ContractOtpResponse verifyOtp(UUID contractId, String otp);

    void requireVerified(UUID contractId);
}
