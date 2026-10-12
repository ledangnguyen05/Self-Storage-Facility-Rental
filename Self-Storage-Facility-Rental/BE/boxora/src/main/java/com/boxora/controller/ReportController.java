package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.response.OccupancyReportResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;

@RestController
@RequestMapping("api/v1/reports")
@Tag(
        name = "Reports",
        description = "API tổng hợp báo cáo doanh thu và tỷ lệ lấp đầy kho toàn hệ thống"
)
@RequiredArgsConstructor
@Slf4j
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/revenue")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy báo cáo doanh thu toàn hệ thống")
    public ResponseEntity<ApiResponse<RevenueReportResponse>> getRevenueReport(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate
    ) {
        RevenueReportResponse response =
                reportService.getRevenueReport(fromDate, toDate);

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/occupancy")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Lấy báo cáo tỷ lệ lấp đầy kho")
    public ResponseEntity<ApiResponse<OccupancyReportResponse>> getOccupancyReport() {
        OccupancyReportResponse response = reportService.getOccupancyReport();

        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
