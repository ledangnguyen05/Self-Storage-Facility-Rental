package com.boxora.service;

import com.boxora.dto.response.OccupancyReportResponse;
import com.boxora.dto.response.RevenueReportResponse;

import java.time.LocalDate;

public interface ReportService {
    RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate);
    OccupancyReportResponse getOccupancyReport();
}
