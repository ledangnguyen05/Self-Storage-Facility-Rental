package com.boxora.dto.response;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RevenueReportResponse {
    private LocalDate fromDate;
    private LocalDate toDate;
    private SystemRevenueSummaryResponse systemSummary;
    private List<FacilityRevenueResponse> byFacility;
    private List<MonthlyRevenueResponse> monthlyBreakdown;
    private java.math.BigDecimal refundedAmount;
}
