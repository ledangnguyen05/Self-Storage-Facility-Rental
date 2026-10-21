package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeocodeResponse {
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String displayName;
    private String source;
    private String provider;
    private String confidence;
}
