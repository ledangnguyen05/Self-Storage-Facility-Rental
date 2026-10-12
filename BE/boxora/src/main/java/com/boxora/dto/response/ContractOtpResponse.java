package com.boxora.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ContractOtpResponse {
    int expiresInSeconds;
    int resendInSeconds;
    String signingUrl;
}
