package com.boxora.service;

import com.boxora.dto.response.FacilityRevenueResponse;
import com.boxora.dto.response.MonthlyRevenueResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.dto.response.SystemRevenueSummaryResponse;
import com.boxora.entity.Payment;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.impl.ReportServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @InjectMocks
    private ReportServiceImpl reportService;

    private UUID facilityId;

    @BeforeEach
    void setUp() {
        facilityId = UUID.randomUUID();
    }

    @Test
    @DisplayName("getRevenueReport: Deposit is excluded from totalRevenue and tracked separately")
    void getRevenueReport_DepositExcludedFromTotalRevenue() {
        LocalDate fromDate = LocalDate.of(2026, 1, 1);
        LocalDate toDate = LocalDate.of(2026, 3, 31);

        // System summary where totalRevenue = 5,000,000 (rental + renewal + extra), and deposit = 2,000,000
        SystemRevenueSummaryResponse summary = SystemRevenueSummaryResponse.builder()
                .totalRevenue(new BigDecimal("5000000.00")) // Pure business revenue (without deposit)
                .depositRevenue(new BigDecimal("2000000.00")) // Deposit holding
                .rentalFeeRevenue(new BigDecimal("4000000.00"))
                .renewalFeeRevenue(new BigDecimal("800000.00"))
                .extraChargeRevenue(new BigDecimal("200000.00"))
                .paymentCount(10L)
                .build();

        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
        when(paymentRepository.sumRevenueByFacility(any(), any(), eq(null))).thenReturn(List.of());
        when(paymentRepository.sumSystemRevenue(any(), any(), eq(null))).thenReturn(summary);
        when(paymentRepository.findSuccessfulPaymentsInPeriod(any(), any(), eq(null))).thenReturn(List.of());
        when(paymentRepository.sumRefundedAmount(any(), any(), eq(null))).thenReturn(new BigDecimal("150000.00"));

        RevenueReportResponse report = reportService.getRevenueReport(fromDate, toDate, null);

        assertThat(report.getSystemSummary().getTotalRevenue()).isEqualTo(new BigDecimal("5000000.00"));
        assertThat(report.getSystemSummary().getDepositRevenue()).isEqualTo(new BigDecimal("2000000.00"));
        assertThat(report.getRefundedAmount()).isEqualTo(new BigDecimal("150000.00"));
        // Deposit should not inflate total business revenue
        assertThat(report.getSystemSummary().getTotalRevenue()).isNotEqualTo(new BigDecimal("7000000.00"));
    }

    @Test
    @DisplayName("getRevenueReport: Builds authoritative monthlyBreakdown correctly with pure total")
    void getRevenueReport_BuildsMonthlyBreakdownCorrectly() {
        LocalDate fromDate = LocalDate.of(2026, 1, 1);
        LocalDate toDate = LocalDate.of(2026, 2, 28);

        Payment p1 = Payment.builder()
                .paymentType(PaymentType.RENTAL_FEE)
                .amount(new BigDecimal("1000000.00"))
                .status(PaymentStatus.PAID)
                .paymentTime(LocalDateTime.of(2026, 1, 15, 10, 0))
                .build();

        Payment p2 = Payment.builder()
                .paymentType(PaymentType.DEPOSIT)
                .amount(new BigDecimal("500000.00"))
                .status(PaymentStatus.PAID)
                .paymentTime(LocalDateTime.of(2026, 1, 20, 14, 0))
                .build();

        Payment p3 = Payment.builder()
                .paymentType(PaymentType.RENEWAL_FEE)
                .amount(new BigDecimal("1200000.00"))
                .status(PaymentStatus.PAID)
                .paymentTime(LocalDateTime.of(2026, 2, 5, 9, 30))
                .build();

        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
        when(paymentRepository.sumRevenueByFacility(any(), any(), eq(null))).thenReturn(List.of());
        when(paymentRepository.sumSystemRevenue(any(), any(), eq(null))).thenReturn(
                SystemRevenueSummaryResponse.builder()
                        .totalRevenue(new BigDecimal("2200000.00"))
                        .depositRevenue(new BigDecimal("500000.00"))
                        .rentalFeeRevenue(new BigDecimal("1000000.00"))
                        .renewalFeeRevenue(new BigDecimal("1200000.00"))
                        .extraChargeRevenue(BigDecimal.ZERO)
                        .paymentCount(3L)
                        .build()
        );
        when(paymentRepository.findSuccessfulPaymentsInPeriod(any(), any(), eq(null)))
                .thenReturn(List.of(p1, p2, p3));
        when(paymentRepository.sumRefundedAmount(any(), any(), eq(null)))
                .thenReturn(BigDecimal.ZERO);

        RevenueReportResponse report = reportService.getRevenueReport(fromDate, toDate, null);

        assertThat(report.getMonthlyBreakdown()).hasSize(2);

        // Month 1: 2026-01
        MonthlyRevenueResponse m1 = report.getMonthlyBreakdown().get(0);
        assertThat(m1.getMonthKey()).isEqualTo("2026-01");
        assertThat(m1.getLabel()).isEqualTo("T01/26");
        assertThat(m1.getRentalFee()).isEqualByComparingTo("1000000.00");
        assertThat(m1.getDeposit()).isEqualByComparingTo("500000.00");
        // Month total must only include business revenue (rent + renewal + extra = 1,000,000), NOT deposit
        assertThat(m1.getTotal()).isEqualByComparingTo("1000000.00");

        // Month 2: 2026-02
        MonthlyRevenueResponse m2 = report.getMonthlyBreakdown().get(1);
        assertThat(m2.getMonthKey()).isEqualTo("2026-02");
        assertThat(m2.getLabel()).isEqualTo("T02/26");
        assertThat(m2.getRenewalFee()).isEqualByComparingTo("1200000.00");
        assertThat(m2.getTotal()).isEqualByComparingTo("1200000.00");
    }

    @Test
    @DisplayName("getRevenueReport: Scoped user enforces facility isolation")
    void getRevenueReport_FacilityScopedUser_EnforcesFacilityIsolation() {
        LocalDate fromDate = LocalDate.of(2026, 1, 1);
        LocalDate toDate = LocalDate.of(2026, 1, 31);
        UUID scopedFacId = UUID.randomUUID();

        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        when(facilityAccessGuard.scopedFacilityIdOrNull()).thenReturn(scopedFacId);

        when(paymentRepository.sumRevenueByFacility(any(), any(), eq(scopedFacId))).thenReturn(List.of());
        when(paymentRepository.sumSystemRevenue(any(), any(), eq(scopedFacId))).thenReturn(null);
        when(paymentRepository.findSuccessfulPaymentsInPeriod(any(), any(), eq(scopedFacId))).thenReturn(List.of());
        when(paymentRepository.sumRefundedAmount(any(), any(), eq(scopedFacId))).thenReturn(BigDecimal.ZERO);

        // Caller requested null, but facilityAccessGuard should enforce scopedFacId
        RevenueReportResponse report = reportService.getRevenueReport(fromDate, toDate, null);

        assertThat(report).isNotNull();
        assertThat(report.getSystemSummary().getTotalRevenue()).isEqualTo(BigDecimal.ZERO);
    }
}

