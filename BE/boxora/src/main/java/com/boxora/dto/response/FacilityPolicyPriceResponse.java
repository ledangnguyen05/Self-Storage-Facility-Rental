package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicyPriceResponse {
    private UUID unitTypeId;
    private String unitTypeName;
    private BigDecimal monthlyPrice;
    private Double discount3MonthPercent;
    private Double discount6MonthPercent;
    private Double discount12MonthPercent;
}
