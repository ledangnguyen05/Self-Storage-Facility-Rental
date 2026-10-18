package com.boxora.service;

import com.boxora.dto.response.OverdueDebtReportResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.dto.response.SystemRevenueSummaryResponse;
import com.boxora.enums.ActivityAction;
import com.boxora.entity.*;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.impl.ReportServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private EmailService emailService;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;

    @InjectMocks
    private ReportServiceImpl reportService;

    private Facility facility;
    private FacilityPolicy policy;
    private StorageUnit unit;

    @BeforeEach
    void setUp() {
        facility = Facility.builder().name("Boxora Central").build();
        facility.setId(UUID.randomUUID());
        unit = StorageUnit.builder().unitCode("A-101").facility(facility).build();
        unit.setId(UUID.randomUUID());
        policy = FacilityPolicy.builder()
                .facility(facility)
                .overdueGraceDays(1)
                .overdueAccessDisableDays(3)
                .overdueSealingDays(7)
                .dailyLateFee(new BigDecimal("100"))
                .build();
        lenient().when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()))
                .thenReturn(Optional.of(policy));
    }

    @Test
    void overdueReportDoesNotCallContractMonthlyFeeAnUnpaidBalance() {
        RentalContract contract = RentalContract.builder()
                .contractCode("RC-101")
                .facility(facility)
                .unit(unit)
                .startDate(LocalDate.now().minusMonths(2))
                .endDate(LocalDate.now().minusDays(4))
                .monthlyFee(new BigDecimal("1500000"))
                .status(RentalContractStatus.OVERDUE)
                .build();
        contract.setId(UUID.randomUUID());
        when(rentalContractRepository.findAll()).thenReturn(List.of(contract));
        when(bookingRepository.findAll()).thenReturn(List.of());

        OverdueDebtReportResponse report = reportService.getOverdueDebtReport(null);

        assertThat(report.getItems()).hasSize(1);
        assertThat(report.getItems().get(0).getUnpaidRent()).isNull();
        assertThat(report.getItems().get(0).getTotalLateFee()).isEqualByComparingTo("300");
        assertThat(report.getItems().get(0).getTotalDebt()).isNull();
        assertThat(report.getTotalDebtAmount()).isNull();
        assertThat(report.getItems().get(0).getSmartLockStatus()).isEqualTo("UNVERIFIED");
    }

    @Test
    void revenueChartAndPaymentChannelsUseTheSamePaidPeriodAndFacilityScope() {
        UUID selectedFacilityId = UUID.randomUUID();
        LocalDate fromDate = LocalDate.of(2026, 3, 1);
        LocalDate toDate = LocalDate.of(2026, 3, 31);
        LocalDateTime from = fromDate.atStartOfDay();
        LocalDateTime to = toDate.atTime(LocalTime.MAX);
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
        when(paymentRepository.sumRevenueByFacility(from, to, selectedFacilityId)).thenReturn(List.of());
        when(paymentRepository.sumSystemRevenue(from, to, selectedFacilityId)).thenReturn(
                SystemRevenueSummaryResponse.builder()
                        .totalRevenue(new BigDecimal("350"))
                        .depositRevenue(new BigDecimal("50"))
                        .rentalFeeRevenue(new BigDecimal("200"))
                        .renewalFeeRevenue(new BigDecimal("25"))
                        .extraChargeRevenue(new BigDecimal("25"))
                        .bookingPaymentRevenue(new BigDecimal("50"))
                        .paymentCount(3L)
                        .build());
        when(paymentRepository.sumRevenueByMonth(from, to, selectedFacilityId)).thenReturn(
                java.util.Collections.singletonList(new Object[]{
                        2026, 3, new BigDecimal("200"), new BigDecimal("50"),
                        new BigDecimal("25"), new BigDecimal("25"), new BigDecimal("50"),
                        new BigDecimal("350"), 3L
                }));
        when(paymentRepository.countPaidPaymentsByMethod(from, to, selectedFacilityId)).thenReturn(
                Arrays.asList(new Object[]{"VNPAY", 2L}, new Object[]{null, 1L}));

        RevenueReportResponse report = reportService.getRevenueReport(fromDate, toDate, selectedFacilityId);

        assertThat(report.getSystemSummary().getPaymentCount()).isEqualTo(3L);
        assertThat(report.getMonthlyRevenue()).hasSize(1);
        assertThat(report.getMonthlyRevenue().get(0).getMonth()).isEqualTo("2026-03");
        assertThat(report.getMonthlyRevenue().get(0).getTotalRevenue()).isEqualByComparingTo("350");
        assertThat(report.getMonthlyRevenue().get(0).getExtraChargeRevenue()).isEqualByComparingTo("25");
        assertThat(report.getMonthlyRevenue().get(0).getBookingPaymentRevenue()).isEqualByComparingTo("50");
        assertThat(report.getPaymentsByMethod()).hasSize(2);
        assertThat(report.getPaymentsByMethod()).extracting("paymentMethod").containsExactlyInAnyOrder(null, "VNPAY");
        assertThat(report.getPaymentsByMethod()).extracting("paymentCount").containsExactlyInAnyOrder(1L, 2L);
        verify(paymentRepository).sumRevenueByMonth(from, to, selectedFacilityId);
        verify(paymentRepository).countPaidPaymentsByMethod(from, to, selectedFacilityId);
    }

    @Test
    void occupancyReportIncludesFacilitiesThatCurrentlyHaveNoUnits() {
        Facility emptyFacility = Facility.builder().name("Boxora Empty").build();
        emptyFacility.setId(UUID.randomUUID());
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
        when(facilityRepository.findAll()).thenReturn(List.of(facility, emptyFacility));
        when(storageUnitRepository.countUnitsGroupedByFacilityAndStatus()).thenReturn(List.of());

        var report = reportService.getOccupancyReport();

        assertThat(report.getByFacility()).hasSize(2);
        assertThat(report.getByFacility()).allSatisfy(row -> {
            assertThat(row.getTotalUnits()).isZero();
            assertThat(row.getOccupiedUnits()).isZero();
            assertThat(row.getAvailableUnits()).isZero();
            assertThat(row.getReservedUnits()).isZero();
            assertThat(row.getMaintenanceUnits()).isZero();
            assertThat(row.getOccupancyRate()).isZero();
        });
        assertThat(report.getSystemSummary().getTotalUnits()).isZero();
    }

    @Test
    void overdueReportUsesReconciledBookingPaymentStatusForInitialRent() {
        Booking booking = overdueBooking("PAID");
        when(rentalContractRepository.findAll()).thenReturn(List.of());
        when(bookingRepository.findAll()).thenReturn(List.of(booking));

        OverdueDebtReportResponse report = reportService.getOverdueDebtReport(null);

        assertThat(report.getItems()).hasSize(1);
        assertThat(report.getItems().get(0).getUnpaidRent()).isEqualByComparingTo("0");
        assertThat(report.getItems().get(0).getTotalLateFee()).isEqualByComparingTo("300");
        assertThat(report.getItems().get(0).getTotalDebt()).isEqualByComparingTo("300");
    }

    @Test
    void overdueReportLeavesPartiallyPaidBookingBalanceUnreconciled() {
        Booking booking = overdueBooking("PARTIALLY_PAID");
        when(rentalContractRepository.findAll()).thenReturn(List.of());
        when(bookingRepository.findAll()).thenReturn(List.of(booking));

        OverdueDebtReportResponse report = reportService.getOverdueDebtReport(null);

        assertThat(report.getItems()).hasSize(1);
        assertThat(report.getItems().get(0).getUnpaidRent()).isNull();
        assertThat(report.getItems().get(0).getTotalDebt()).isNull();
        assertThat(report.getTotalDebtAmount()).isNull();
    }

    @Test
    void overdueReminderSendsUnknownBalanceAndUsesDistinctAuditAction() {
        User customer = User.builder().fullName("Customer").email("customer@example.com").build();
        RentalContract contract = RentalContract.builder()
                .contractCode("RC-REMINDER")
                .customer(customer)
                .facility(facility)
                .unit(unit)
                .endDate(LocalDate.now().minusDays(4))
                .monthlyFee(new BigDecimal("1500000"))
                .status(RentalContractStatus.OVERDUE)
                .build();
        contract.setId(UUID.randomUUID());
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));

        reportService.sendOverdueReminder(contract.getId());

        verify(emailService).sendOverdueNoticeEmail(
                eq("customer@example.com"), eq("Customer"), eq("RC-REMINDER"), eq("A-101"),
                eq(4L), isNull(), eq("ACCESS_BLOCKED"));
        verify(activityLogService).record(
                eq(facility.getId()), eq(ActivityAction.OVERDUE_REMINDER_SENT), eq("RentalContract"),
                eq(contract.getId()), contains("not reconciled"), isNull(), eq("RC-REMINDER"));
    }

    private Booking overdueBooking(String paymentStatus) {
        Booking booking = Booking.builder()
                .bookingCode("BK-101")
                .storageUnit(unit)
                .startDate(LocalDate.now().minusMonths(2))
                .endDate(LocalDate.now().minusDays(4))
                .rentalMonths(1)
                .totalRentalFee(new BigDecimal("1500000"))
                .depositPaid(BigDecimal.ZERO)
                .paymentStatus(paymentStatus)
                .status(BookingStatus.ACTIVE)
                .build();
        booking.setId(UUID.randomUUID());
        return booking;
    }
}
