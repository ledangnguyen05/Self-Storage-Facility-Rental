package com.boxora.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class BookingAccessCredentialsResponse {
    String accessPin;
    String qrAccessToken;
}
