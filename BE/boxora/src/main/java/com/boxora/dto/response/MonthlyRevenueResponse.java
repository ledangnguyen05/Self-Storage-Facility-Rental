package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyRevenueResponse {
    private String monthKey;
    private String label;
    private BigDecimal rentalFee;
    private BigDecimal deposit;
    private BigDecimal renewalFee;
    private BigDecimal extraCharge;
    private BigDecimal total;
}

