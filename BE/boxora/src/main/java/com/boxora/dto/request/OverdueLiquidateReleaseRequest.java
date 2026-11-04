package com.boxora.dto.request;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueLiquidateReleaseRequest {
    private BigDecimal liquidationAmount;
    private String notes;
}

