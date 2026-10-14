package com.boxora.service;

import com.boxora.dto.response.OccupancyReportResponse;
import com.boxora.dto.response.RevenueReportResponse;

import java.time.LocalDate;
import java.util.UUID;

public interface ReportService {
    RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate);
    RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate, UUID facilityId);
    OccupancyReportResponse getOccupancyReport();
    OccupancyReportResponse getOccupancyReport(UUID facilityId);
    com.boxora.dto.response.OverdueDebtReportResponse getOverdueDebtReport(java.util.UUID facilityId);
    void sendOverdueReminder(java.util.UUID contractId);
}
