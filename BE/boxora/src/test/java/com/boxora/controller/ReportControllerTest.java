package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.response.*;
import com.boxora.service.ReportService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportControllerTest {

    @Mock
    private ReportService reportService;

    @InjectMocks
    private ReportController reportController;

    @Test
    @DisplayName("Security: getRevenueReport and exportRevenueCsv must restrict access to ADMIN and BUSINESS_MANAGER only")
    void revenueEndpointsMustHaveRoleRestrictions() throws NoSuchMethodException {
        Method getRevenueMethod = ReportController.class.getMethod("getRevenueReport", LocalDate.class, LocalDate.class, UUID.class);
        PreAuthorize preAuthRev = getRevenueMethod.getAnnotation(PreAuthorize.class);
        assertThat(preAuthRev).isNotNull();
        assertThat(preAuthRev.value()).contains("ADMIN").contains("BUSINESS_MANAGER");
        assertThat(preAuthRev.value()).doesNotContain("FACILITY_MANAGER").doesNotContain("STAFF");

        Method exportCsvMethod = ReportController.class.getMethod("exportRevenueCsv", LocalDate.class, LocalDate.class, UUID.class);
        PreAuthorize preAuthExport = exportCsvMethod.getAnnotation(PreAuthorize.class);
        assertThat(preAuthExport).isNotNull();
        assertThat(preAuthExport.value()).contains("ADMIN").contains("BUSINESS_MANAGER");
        assertThat(preAuthExport.value()).doesNotContain("FACILITY_MANAGER").doesNotContain("STAFF");
    }

    @Test
    @DisplayName("getRevenueReport returns 200 with complete report response")
    void getRevenueReportSuccess() {
        LocalDate fromDate = LocalDate.of(2026, 10, 1);
        LocalDate toDate = LocalDate.of(2026, 10, 29);
        UUID facilityId = UUID.randomUUID();

        RevenueReportResponse mockResponse = RevenueReportResponse.builder()
                .systemSummary(SystemRevenueSummaryResponse.builder()
                        .netRevenue(new BigDecimal("150000000"))
                        .totalCashIn(new BigDecimal("190000000"))
                        .rentalRevenue(new BigDecimal("145000000"))
                        .depositsHeld(new BigDecimal("35000000"))
                        .totalOverdueDebt(new BigDecimal("12000000"))
                        .refundedAmount(new BigDecimal("2000000"))
                        .pendingRefundAmount(new BigDecimal("1500000"))
                        .paymentCount(42L)
                        .build())
                .debtBreakdown(DebtBreakdownResponse.builder()
                        .totalDebt(new BigDecimal("12000000"))
                        .totalCount(5L)
                        .build())
                .refundBreakdown(RefundBreakdownResponse.builder()
                        .completedRefundAmount(new BigDecimal("2000000"))
                        .pendingReviewAmount(new BigDecimal("1500000"))
                        .build())
                .build();

        when(reportService.getRevenueReport(fromDate, toDate, facilityId)).thenReturn(mockResponse);

        ResponseEntity<ApiResponse<RevenueReportResponse>> response =
                reportController.getRevenueReport(fromDate, toDate, facilityId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).isSameAs(mockResponse);
        verify(reportService).getRevenueReport(fromDate, toDate, facilityId);
    }

    @Test
    @DisplayName("exportRevenueCsv returns byte array containing CSV with correct headers and facility rows")
    void exportRevenueCsvSuccess() {
        LocalDate fromDate = LocalDate.of(2026, 10, 1);
        LocalDate toDate = LocalDate.of(2026, 10, 29);
        UUID facilityId = UUID.randomUUID();

        FacilityRevenueResponse facilityRow = FacilityRevenueResponse.builder()
                .facilityId(facilityId)
                .facilityName("Boxora Thu Duc")
                .netRevenue(new BigDecimal("80000000"))
                .totalCashIn(new BigDecimal("100000000"))
                .rentalRevenue(new BigDecimal("75000000"))
                .depositsHeld(new BigDecimal("20000000"))
                .totalOverdueDebt(new BigDecimal("5000000"))
                .refundedAmount(BigDecimal.ZERO)
                .paymentCount(25L)
                .build();

        RevenueReportResponse mockResponse = RevenueReportResponse.builder()
                .systemSummary(SystemRevenueSummaryResponse.builder()
                        .netRevenue(new BigDecimal("150000000"))
                        .totalCashIn(new BigDecimal("190000000"))
                        .rentalRevenue(new BigDecimal("145000000"))
                        .depositsHeld(new BigDecimal("35000000"))
                        .totalOverdueDebt(new BigDecimal("12000000"))
                        .refundedAmount(new BigDecimal("2000000"))
                        .pendingRefundAmount(new BigDecimal("1500000"))
                        .paymentCount(42L)
                        .build())
                .byFacility(List.of(facilityRow))
                .build();

        when(reportService.getRevenueReport(fromDate, toDate, facilityId)).thenReturn(mockResponse);

        ResponseEntity<byte[]> response = reportController.exportRevenueCsv(fromDate, toDate, facilityId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();

        String csv = new String(response.getBody(), StandardCharsets.UTF_8);
        assertThat(csv).contains("BÁO CÁO DOANH THU & TÀI CHÍNH BOXORA");
        assertThat(csv).contains("Tổng doanh thu thuần,150000000");
        assertThat(csv).contains("Tổng tiền thực thu,190000000");
        assertThat(csv).contains("Boxora Thu Duc");
        assertThat(csv).contains("80000000");
    }
}
