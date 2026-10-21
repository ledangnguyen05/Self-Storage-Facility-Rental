package com.boxora.service.impl;

import com.boxora.dto.response.FacilityOccupancyResponse;
import com.boxora.dto.response.FacilityRevenueResponse;
import com.boxora.dto.response.MonthlyRevenueResponse;
import com.boxora.dto.response.OccupancyReportResponse;
import com.boxora.dto.response.PaymentChannelReportResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.dto.response.RevenueTrendResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.RentalContract;
import com.boxora.entity.User;
import com.boxora.enums.NotificationType;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.PaymentReportRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.UnitReportRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmailService;
import com.boxora.service.OverdueFeeCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReportServiceImplTest {

    @Mock private PaymentReportRepository paymentReportRepository;
    @Mock private UnitReportRepository unitReportRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private NotificationLogRepository notificationLogRepository;
    @Mock private OverdueDebtReportBuilder overdueDebtReportBuilder;
    @Mock private EmailService emailService;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;

    private ReportServiceImpl service;
    private Facility d1;
    private Facility d7;

    @BeforeEach
    void setUp() {
        service = new ReportServiceImpl(paymentReportRepository, unitReportRepository, facilityRepository,
                rentalContractRepository, notificationLogRepository, overdueDebtReportBuilder, emailService,
                activityLogService, facilityAccessGuard);
        d1 = facility("Boxora District 1");
        d7 = facility("Boxora District 7");
        when(facilityRepository.findAllByOrderByCreatedAtAsc()).thenReturn(List.of(d1, d7));
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);
    }

    private static Facility facility(String name) {
        Facility facility = Facility.builder().name(name).code(name.replace(' ', '-')).address("addr").build();
        facility.setId(UUID.randomUUID());
        return facility;
    }

    private static Object[] revenueRow(Facility facility, PaymentType type, PaymentStatus status, String sum, long count, String bookingDepositPart) {
        return new Object[]{facility == null ? null : facility.getId(), facility == null ? null : facility.getName(), type, status,
                new BigDecimal(sum), count, new BigDecimal(bookingDepositPart)};
    }

    // ------------------------------------------------------------------ revenue

    @Test
    @DisplayName("Revenue: BOOKING_PAYMENT is split into rent and deposit, so the buckets add up to the collected amount")
    void revenueSplitsBookingPayments() {
        when(paymentReportRepository.aggregateByFacilityTypeAndStatus(any(), any(), any())).thenReturn(List.of(
                // 3 online payments: 1.5M each = 1M first rent + 0.5M deposit
                revenueRow(d1, PaymentType.BOOKING_PAYMENT, PaymentStatus.PAID, "4500000", 3, "1500000"),
                revenueRow(d1, PaymentType.RENEWAL_FEE, PaymentStatus.PAID, "2000000", 1, "0"),
                revenueRow(d1, PaymentType.EXTRA_CHARGE, PaymentStatus.PAID, "100000", 1, "0")));

        RevenueReportResponse report = service.getRevenueReport(null, null, null);

        FacilityRevenueResponse row = report.getByFacility().stream().filter(r -> d1.getId().equals(r.getFacilityId())).findFirst().orElseThrow();
        assertThat(row.getCollectedAmount()).isEqualByComparingTo("6600000");
        assertThat(row.getDepositRevenue()).isEqualByComparingTo("1500000");
        assertThat(row.getRentalFeeRevenue()).isEqualByComparingTo("3000000");
        assertThat(row.getRenewalFeeRevenue()).isEqualByComparingTo("2000000");
        assertThat(row.getExtraChargeRevenue()).isEqualByComparingTo("100000");
        assertThat(row.getDepositRevenue().add(row.getRentalFeeRevenue()).add(row.getRenewalFeeRevenue()).add(row.getExtraChargeRevenue()))
                .isEqualByComparingTo(row.getCollectedAmount());
        assertThat(row.getPaymentCount()).isEqualTo(5);
    }

    @Test
    @DisplayName("Revenue: refunds are netted, pending refunds are shown but not netted")
    void revenueNetsRefunds() {
        when(paymentReportRepository.aggregateByFacilityTypeAndStatus(any(), any(), any())).thenReturn(List.of(
                revenueRow(d1, PaymentType.RENTAL_FEE, PaymentStatus.PAID, "10000000", 2, "0"),
                revenueRow(d1, PaymentType.DEPOSIT, PaymentStatus.PAID, "2000000", 1, "0"),
                revenueRow(d1, PaymentType.DEPOSIT, PaymentStatus.REFUNDED, "2000000", 1, "0"),
                revenueRow(d1, PaymentType.DEPOSIT, PaymentStatus.REFUND_PENDING, "500000", 1, "0")));

        RevenueReportResponse report = service.getRevenueReport(null, null, null);

        assertThat(report.getSystemSummary().getCollectedAmount()).isEqualByComparingTo("12000000");
        assertThat(report.getSystemSummary().getRefundedAmount()).isEqualByComparingTo("2000000");
        assertThat(report.getSystemSummary().getPendingRefundAmount()).isEqualByComparingTo("500000");
        assertThat(report.getSystemSummary().getTotalRevenue()).isEqualByComparingTo("10000000");
        // only PAID rows are counted as payments
        assertThat(report.getSystemSummary().getPaymentCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("Revenue: every facility has a row (0 when idle) and the system total equals the sum of the rows")
    void revenueHasZeroRowsAndConsistentTotals() {
        when(paymentReportRepository.aggregateByFacilityTypeAndStatus(any(), any(), any())).thenReturn(List.of(
                revenueRow(d1, PaymentType.RENTAL_FEE, PaymentStatus.PAID, "1000000", 1, "0"),
                revenueRow(null, PaymentType.EXTRA_CHARGE, PaymentStatus.PAID, "50000", 1, "0")));

        RevenueReportResponse report = service.getRevenueReport(null, null, null);

        assertThat(report.getByFacility()).extracting(FacilityRevenueResponse::getFacilityName)
                .contains("Boxora District 1", "Boxora District 7");
        FacilityRevenueResponse idle = report.getByFacility().stream().filter(r -> d7.getId().equals(r.getFacilityId())).findFirst().orElseThrow();
        assertThat(idle.getTotalRevenue()).isEqualByComparingTo("0");
        assertThat(idle.getPaymentCount()).isZero();
        BigDecimal sum = report.getByFacility().stream().map(FacilityRevenueResponse::getTotalRevenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(report.getSystemSummary().getTotalRevenue()).isEqualByComparingTo(sum).isEqualByComparingTo("1050000");
    }

    @Test
    @DisplayName("Revenue: the period is inclusive of the last day (upper bound is the start of the next day)")
    void revenuePeriodBounds() {
        when(paymentReportRepository.aggregateByFacilityTypeAndStatus(any(), any(), any())).thenReturn(List.of());

        service.getRevenueReport(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), null);

        verify(paymentReportRepository).aggregateByFacilityTypeAndStatus(
                eq(LocalDateTime.of(2026, 3, 1, 0, 0)), eq(LocalDateTime.of(2026, 4, 1, 0, 0)), eq(null));
    }

    @Test
    @DisplayName("Revenue: a start date after the end date is rejected with a Vietnamese message")
    void revenueRejectsReversedPeriod() {
        assertThatThrownBy(() -> service.getRevenueReport(LocalDate.of(2026, 5, 2), LocalDate.of(2026, 5, 1), null))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.REPORT_INVALID_PERIOD));
    }

    @Test
    @DisplayName("Scope: a facility-scoped user always gets its own facility, whatever facilityId is sent")
    void scopedUserIsForcedToOwnFacility() {
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        when(facilityAccessGuard.scopedFacilityIdOrNull()).thenReturn(d1.getId());
        when(paymentReportRepository.aggregateByFacilityTypeAndStatus(any(), any(), any())).thenReturn(List.of());

        RevenueReportResponse report = service.getRevenueReport(null, null, d7.getId());

        verify(paymentReportRepository).aggregateByFacilityTypeAndStatus(any(), any(), eq(d1.getId()));
        assertThat(report.getByFacility()).extracting(FacilityRevenueResponse::getFacilityId).containsExactly(d1.getId());
    }

    @Test
    @DisplayName("Scope: a scoped account without a facility is denied instead of seeing every facility")
    void scopedUserWithoutFacilityIsDenied() {
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        when(facilityAccessGuard.scopedFacilityIdOrNull()).thenReturn(null);

        assertThatThrownBy(() -> service.getRevenueReport(null, null, null))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED));
        assertThatThrownBy(() -> service.getOccupancyReport(null))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED));
        assertThatThrownBy(() -> service.getOverdueDebtReport(null))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED));
    }

    // ------------------------------------------------------------------ trend / channels

    @Test
    @DisplayName("Trend: months of the chosen period are continuous, zero-filled, split by type and net of refunds")
    void trendIsZeroFilledAndNet() {
        when(paymentReportRepository.aggregateByMonth(any(), any(), any())).thenReturn(List.of(
                new Object[]{2026, 1, PaymentType.RENTAL_FEE, PaymentStatus.PAID, new BigDecimal("3000000"), 2L},
                new Object[]{2026, 1, PaymentType.DEPOSIT, PaymentStatus.PAID, new BigDecimal("500000"), 1L},
                new Object[]{2026, 3, PaymentType.DEPOSIT, PaymentStatus.REFUNDED, new BigDecimal("500000"), 1L},
                new Object[]{2026, 3, PaymentType.BOOKING_PAYMENT, PaymentStatus.PAID, new BigDecimal("1500000"), 1L}));

        RevenueTrendResponse trend = service.getRevenueTrend(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 4, 15), null);

        assertThat(trend.getMonths()).extracting(MonthlyRevenueResponse::getMonth)
                .containsExactly("2026-01", "2026-02", "2026-03", "2026-04");
        MonthlyRevenueResponse january = trend.getMonths().get(0);
        assertThat(january.getCollectedAmount()).isEqualByComparingTo("3500000");
        assertThat(january.getCollectedByType().get("RENTAL_FEE")).isEqualByComparingTo("3000000");
        assertThat(january.getCollectedByType().get("DEPOSIT")).isEqualByComparingTo("500000");
        assertThat(january.getPaymentCount()).isEqualTo(3);
        assertThat(trend.getMonths().get(1).getNetAmount()).isEqualByComparingTo("0");
        MonthlyRevenueResponse march = trend.getMonths().get(2);
        assertThat(march.getRefundedAmount()).isEqualByComparingTo("500000");
        assertThat(march.getNetAmount()).isEqualByComparingTo("1000000");
        assertThat(trend.getTotalCollected()).isEqualByComparingTo("5000000");
        assertThat(trend.getTotalRefunded()).isEqualByComparingTo("500000");
        assertThat(trend.getTotalNet()).isEqualByComparingTo("4500000");
        verify(paymentReportRepository).aggregateByMonth(
                eq(LocalDateTime.of(2026, 1, 1, 0, 0)), eq(LocalDateTime.of(2026, 4, 16, 0, 0)), eq(null));
    }

    @Test
    @DisplayName("Trend: an open period without payments yields no months instead of an invented series")
    void trendWithoutDataIsEmpty() {
        when(paymentReportRepository.aggregateByMonth(any(), any(), any())).thenReturn(List.of());

        RevenueTrendResponse trend = service.getRevenueTrend(null, null, null);

        assertThat(trend.getMonths()).isEmpty();
        assertThat(trend.getTotalNet()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("Channels: methods are normalised, merged and sorted by number of payments")
    void channelsAreNormalised() {
        when(paymentReportRepository.aggregateByMethod(any(), any(), any())).thenReturn(List.of(
                new Object[]{"vnpay", 4L, new BigDecimal("4000000")},
                new Object[]{"VNPAY", 1L, new BigDecimal("1000000")},
                new Object[]{"CASH", 2L, new BigDecimal("700000")},
                new Object[]{null, 1L, new BigDecimal("50000")}));

        PaymentChannelReportResponse report = service.getPaymentChannels(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31), null);

        assertThat(report.getChannels()).extracting(c -> c.getMethod() + ":" + c.getCount())
                .containsExactly("VNPAY:5", "CASH:2", "OTHER:1");
        assertThat(report.getTotalCount()).isEqualTo(8);
        assertThat(report.getTotalAmount()).isEqualByComparingTo("5750000");
    }

    // ------------------------------------------------------------------ occupancy

    @Test
    @DisplayName("Occupancy: locked units count as occupied and the buckets add up to the total")
    void occupancyCountsLockedUnits() {
        UUID empty = UUID.randomUUID();
        when(unitReportRepository.countUnitsByFacilityAndStatus()).thenReturn(List.of(
                new Object[]{d1.getId(), d1.getName(), UnitStatus.OCCUPIED, 6L},
                new Object[]{d1.getId(), d1.getName(), UnitStatus.OVERDUE_LOCKED, 2L},
                new Object[]{d1.getId(), d1.getName(), UnitStatus.AVAILABLE, 10L},
                new Object[]{d1.getId(), d1.getName(), UnitStatus.RESERVED, 1L},
                new Object[]{d1.getId(), d1.getName(), UnitStatus.UNDER_MAINTENANCE, 1L},
                new Object[]{empty, "Boxora Empty", null, 0L}));

        OccupancyReportResponse report = service.getOccupancyReport(null);

        FacilityOccupancyResponse row = report.getByFacility().stream().filter(r -> d1.getId().equals(r.getFacilityId())).findFirst().orElseThrow();
        assertThat(row.getTotalUnits()).isEqualTo(20);
        assertThat(row.getOccupiedUnits()).isEqualTo(8);
        assertThat(row.getLockedUnits()).isEqualTo(2);
        assertThat(row.getOccupiedUnits() + row.getAvailableUnits() + row.getReservedUnits() + row.getMaintenanceUnits())
                .isEqualTo(row.getTotalUnits());
        assertThat(row.getOccupancyRate()).isEqualTo(40.0);

        FacilityOccupancyResponse none = report.getByFacility().stream().filter(r -> empty.equals(r.getFacilityId())).findFirst().orElseThrow();
        assertThat(none.getTotalUnits()).isZero();
        assertThat(none.getOccupancyRate()).isZero();

        assertThat(report.getSystemSummary().getTotalUnits()).isEqualTo(20);
        assertThat(report.getSystemSummary().getLockedUnits()).isEqualTo(2);
        assertThat(report.getSystemSummary().getOccupancyRate()).isEqualTo(40.0);
    }

    // ------------------------------------------------------------------ reminder

    private RentalContract overdueContract(String email) {
        User customer = User.builder().username("khach").fullName("Nguyen <Van> A").email(email).build();
        customer.setId(UUID.randomUUID());
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-REM-1")
                .customer(customer)
                .facility(d1)
                .endDate(LocalDate.now().minusDays(5))
                .startDate(LocalDate.now().minusMonths(6))
                .monthlyFee(new BigDecimal("1000000"))
                .status(RentalContractStatus.OVERDUE)
                .build();
        contract.setId(UUID.randomUUID());
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        return contract;
    }

    private static OverdueDebtReportBuilder.DebtFigures figures() {
        return new OverdueDebtReportBuilder.DebtFigures(5, OverdueFeeCalculator.Stage.ACCESS_BLOCKED,
                OverdueFeeCalculator.OverduePolicy.defaults(), new BigDecimal("1000000"), new BigDecimal("200000"), BigDecimal.ZERO);
    }

    @Test
    @DisplayName("Reminder: sent synchronously, escaped, and only then logged")
    void reminderIsSentAndLogged() {
        RentalContract contract = overdueContract("khach@example.com");
        when(overdueDebtReportBuilder.figuresFor(any(), any())).thenReturn(figures());
        when(emailService.isMailConfigured()).thenReturn(true);

        service.sendOverdueReminder(contract.getId());

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendNow(eq("khach@example.com"), anyString(), body.capture());
        assertThat(body.getValue()).contains("CTR-REM-1").contains("Nguyen &lt;Van&gt; A").doesNotContain("<Van>");
        ArgumentCaptor<NotificationLog> log = ArgumentCaptor.forClass(NotificationLog.class);
        verify(notificationLogRepository).save(log.capture());
        assertThat(log.getValue().getNotificationType()).isEqualTo(NotificationType.OVERDUE_NOTICE);
        assertThat(log.getValue().getStatus()).isEqualTo("SENT");
        verify(activityLogService).record(any(), any(), eq("RentalContract"), eq(contract.getId()), anyString(), any(), any());
    }

    @Test
    @DisplayName("Reminder: no email on file is an explicit error, nothing is sent or logged")
    void reminderWithoutEmailFails() {
        RentalContract contract = overdueContract(null);
        when(overdueDebtReportBuilder.figuresFor(any(), any())).thenReturn(figures());

        assertThatThrownBy(() -> service.sendOverdueReminder(contract.getId()))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_REMINDER_NO_EMAIL));
        verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
        verify(notificationLogRepository, never()).save(any());
    }

    @Test
    @DisplayName("Reminder: an unconfigured mail server is reported, not hidden behind a success message")
    void reminderWithoutMailServerFails() {
        RentalContract contract = overdueContract("khach@example.com");
        when(overdueDebtReportBuilder.figuresFor(any(), any())).thenReturn(figures());
        when(emailService.isMailConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.sendOverdueReminder(contract.getId()))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_REMINDER_EMAIL_UNAVAILABLE));
        verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Reminder: a send failure propagates and nothing is logged as sent")
    void reminderSendFailurePropagates() {
        RentalContract contract = overdueContract("khach@example.com");
        when(overdueDebtReportBuilder.figuresFor(any(), any())).thenReturn(figures());
        when(emailService.isMailConfigured()).thenReturn(true);
        doThrow(new AppException(ErrorCode.EMAIL_SEND_FAILED)).when(emailService).sendNow(anyString(), anyString(), anyString());

        assertThatThrownBy(() -> service.sendOverdueReminder(contract.getId()))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.EMAIL_SEND_FAILED));
        verify(notificationLogRepository, never()).save(any());
        verify(activityLogService, never()).record(any(), any(), any(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("Reminder: a contract that is not overdue cannot be reminded")
    void reminderForCurrentContractFails() {
        RentalContract contract = overdueContract("khach@example.com");
        when(overdueDebtReportBuilder.figuresFor(any(), any())).thenReturn(null);

        assertThatThrownBy(() -> service.sendOverdueReminder(contract.getId()))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.OVERDUE_REMINDER_NOT_OVERDUE));
    }

    @Test
    @DisplayName("Reminder: a facility-scoped manager cannot remind another facility's customers")
    void reminderChecksFacilityAccess() {
        RentalContract contract = overdueContract("khach@example.com");
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED)).when(facilityAccessGuard).checkFacilityAccess(d1.getId());

        assertThatThrownBy(() -> service.sendOverdueReminder(contract.getId()))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED));
        verify(emailService, never()).sendNow(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Revenue rows list is mutable-safe: unassigned payments appear as their own row after the facilities")
    void unassignedPaymentsAreKeptInTotals() {
        List<Object[]> rows = new ArrayList<>();
        rows.add(revenueRow(null, PaymentType.RENTAL_FEE, PaymentStatus.PAID, "300000", 1, "0"));
        when(paymentReportRepository.aggregateByFacilityTypeAndStatus(any(), any(), any())).thenReturn(rows);

        RevenueReportResponse report = service.getRevenueReport(null, null, null);

        assertThat(report.getSystemSummary().getTotalRevenue()).isEqualByComparingTo("300000");
        FacilityRevenueResponse last = report.getByFacility().get(report.getByFacility().size() - 1);
        assertThat(last.getFacilityId()).isNull();
        assertThat(last.getTotalRevenue()).isEqualByComparingTo("300000");
    }
}
