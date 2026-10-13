package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityOverdueDebtResponse {
    private UUID facilityId;
    private String facilityName;
    private long overdueContractCount;
    private BigDecimal totalUnpaidRent;
    private BigDecimal totalLateFees;
    private BigDecimal totalOverdueDebt;
}
