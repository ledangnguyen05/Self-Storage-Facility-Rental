package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.response.FacilityRevenueResponse;
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
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy báo cáo doanh thu toàn hệ thống hoặc theo cơ sở (Chỉ ADMIN và BUSINESS_MANAGER)")
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

    @GetMapping("/revenue/export")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Xuất file CSV báo cáo doanh thu toàn hệ thống hoặc theo cơ sở (Chỉ ADMIN và BUSINESS_MANAGER)")
    public ResponseEntity<byte[]> exportRevenueCsv(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,

            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,

            @RequestParam(required = false)
            UUID facilityId
    ) {
        RevenueReportResponse report = reportService.getRevenueReport(fromDate, toDate, facilityId);
        StringBuilder sb = new StringBuilder();
        sb.append('\uFEFF'); // UTF-8 BOM
        sb.append("BÁO CÁO DOANH THU & TÀI CHÍNH BOXORA\r\n");
        sb.append("Kỳ báo cáo,").append(fromDate != null ? fromDate : "Toàn bộ").append(" - ").append(toDate != null ? toDate : "Hiện tại").append("\r\n\r\n");
        sb.append("TỔNG QUAN KPI (VND)\r\n");
        if (report.getSystemSummary() != null) {
            sb.append("Tổng doanh thu thuần,").append(report.getSystemSummary().getNetRevenue()).append("\r\n");
            sb.append("Tổng tiền thực thu,").append(report.getSystemSummary().getTotalCashIn()).append("\r\n");
            sb.append("Doanh thu tiền thuê,").append(report.getSystemSummary().getRentalRevenue()).append("\r\n");
            sb.append("Công nợ phải thu,").append(report.getSystemSummary().getTotalOverdueDebt()).append("\r\n");
            sb.append("Tiền cọc đang giữ,").append(report.getSystemSummary().getDepositsHeld()).append("\r\n");
            sb.append("Tiền hoàn thành công,").append(report.getSystemSummary().getRefundedAmount()).append("\r\n");
            sb.append("Tiền hoàn chờ xử lý,").append(report.getSystemSummary().getPendingRefundAmount()).append("\r\n\r\n");
        }

        sb.append("CHI TIẾT THEO CƠ SỞ\r\n");
        sb.append("Cơ sở,Doanh thu thuần,Tiền thực thu,Doanh thu thuê,Tiền cọc giữ,Công nợ quá hạn,Tiền hoàn,Số giao dịch\r\n");
        if (report.getByFacility() != null) {
            for (FacilityRevenueResponse f : report.getByFacility()) {
                sb.append("\"").append(f.getFacilityName() != null ? f.getFacilityName().replace("\"", "\"\"") : "").append("\",")
                        .append(f.getNetRevenue()).append(",")
                        .append(f.getTotalCashIn()).append(",")
                        .append(f.getRentalRevenue()).append(",")
                        .append(f.getDepositsHeld()).append(",")
                        .append(f.getTotalOverdueDebt()).append(",")
                        .append(f.getRefundedAmount()).append(",")
                        .append(f.getPaymentCount()).append("\r\n");
            }
        }

        byte[] bytes = sb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=boxora-revenue-report.csv")
                .contentType(org.springframework.http.MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    @GetMapping("/occupancy")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    @Operation(summary = "Lấy báo cáo tỷ lệ lấp đầy kho toàn hệ thống hoặc theo cơ sở")
    public ResponseEntity<ApiResponse<OccupancyReportResponse>> getOccupancyReport(
            @RequestParam(required = false)
            UUID facilityId
    ) {
        OccupancyReportResponse response = reportService.getOccupancyReport(facilityId);

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/overdue-debt")
    @PreAuthorize("hasAuthority('REPORT_VIEW')")
    @Operation(summary = "Lấy báo cáo chi tiết và tổng hợp nợ cước quá hạn (Overdue Debt & Delinquency)")
    public ResponseEntity<ApiResponse<OverdueDebtReportResponse>> getOverdueDebtReport(
            @RequestParam(required = false) UUID facilityId
    ) {
        OverdueDebtReportResponse response = reportService.getOverdueDebtReport(facilityId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/overdue-debt/{contractId}/send-reminder")
    @PreAuthorize("hasAnyRole('FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Gửi email thông báo nhắc nợ quá hạn và chi tiết tiền phạt trễ hạn tới khách hàng")
    public ResponseEntity<ApiResponse<Void>> sendOverdueReminder(@PathVariable UUID contractId) {
        reportService.sendOverdueReminder(contractId);
        return ResponseEntity.ok(ApiResponse.success("Đã gửi email thông báo nhắc nợ quá hạn thành công", null));
    }
}
