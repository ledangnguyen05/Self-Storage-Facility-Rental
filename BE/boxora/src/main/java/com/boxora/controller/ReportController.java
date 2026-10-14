package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.response.OccupancyReportResponse;
import com.boxora.dto.response.OverdueDebtReportResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@Tag(
        name = "Reports",
        description = "API tổng hợp báo cáo doanh thu, tỷ lệ lấp đầy kho và theo dõi nợ quá hạn"
)
@RequiredArgsConstructor
@Slf4j
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/revenue")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Lấy báo cáo doanh thu toàn hệ thống hoặc theo cơ sở")
    public ResponseEntity<ApiResponse<RevenueReportResponse>> getRevenueReport(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,

            @RequestParam(required = false)
            UUID facilityId
    ) {
        RevenueReportResponse response =
                reportService.getRevenueReport(fromDate, toDate, facilityId);

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/occupancy")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Lấy báo cáo tỷ lệ lấp đầy kho toàn hệ thống hoặc theo cơ sở")
    public ResponseEntity<ApiResponse<OccupancyReportResponse>> getOccupancyReport(
            @RequestParam(required = false)
            UUID facilityId
    ) {
        OccupancyReportResponse response = reportService.getOccupancyReport(facilityId);

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/overdue-debt")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER')")
    @Operation(summary = "Lấy báo cáo chi tiết và tổng hợp nợ cước quá hạn (Overdue Debt & Delinquency)")
    public ResponseEntity<ApiResponse<OverdueDebtReportResponse>> getOverdueDebtReport(
            @RequestParam(required = false) UUID facilityId
    ) {
        OverdueDebtReportResponse response = reportService.getOverdueDebtReport(facilityId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/overdue-debt/{contractId}/send-reminder")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Gửi email thông báo nhắc nợ quá hạn và chi tiết tiền phạt trễ hạn tới khách hàng")
    public ResponseEntity<ApiResponse<Void>> sendOverdueReminder(@PathVariable UUID contractId) {
        reportService.sendOverdueReminder(contractId);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi email thông báo nhắc nợ quá hạn thành công", null));
    }
}
