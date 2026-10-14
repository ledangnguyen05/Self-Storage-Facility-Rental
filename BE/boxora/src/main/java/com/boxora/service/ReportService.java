package com.boxora.service;

import com.boxora.dto.response.OccupancyReportResponse;
import com.boxora.dto.response.RevenueReportResponse;

import java.time.LocalDate;

public interface ReportService {
    RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate);
    RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate, java.util.UUID facilityId);
    OccupancyReportResponse getOccupancyReport();
    com.boxora.dto.response.OverdueDebtReportResponse getOverdueDebtReport(java.util.UUID facilityId);
    void sendOverdueReminder(java.util.UUID contractId);
}
