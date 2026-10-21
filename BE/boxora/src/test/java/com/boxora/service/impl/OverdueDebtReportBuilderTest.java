package com.boxora.service.impl;

import com.boxora.dto.response.OverdueDebtItemResponse;
import com.boxora.dto.response.OverdueDebtReportResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.repository.BookingReportRepository;
import com.boxora.repository.ContractReportRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentReportRepository;
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
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OverdueDebtReportBuilderTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 21);

    @Mock private ContractReportRepository contractReportRepository;
    @Mock private BookingReportRepository bookingReportRepository;
    @Mock private PaymentReportRepository paymentReportRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;

    private OverdueDebtReportBuilder builder;
    private Facility facility;

    @BeforeEach
    void setUp() {
        facility = Facility.builder().name("Boxora District 1").code("HCM-D1").address("123 Nguyen Hue").build();
        facility.setId(UUID.randomUUID());

        // Policy: 1 day grace, access blocked from day 3, sealing from day 7, 50.000 per late day.
        FacilityPolicy policy = FacilityPolicy.builder()
                .facility(facility)
                .depositPercentage(100.0)
                .dailyLateFee(new BigDecimal("50000"))
                .build();
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())).thenReturn(Optional.of(policy));

        when(contractReportRepository.findPastDue(any(), any(), any())).thenReturn(List.of());
        when(bookingReportRepository.findPastDueWithoutContract(any(), any(), any())).thenReturn(List.of());
        when(paymentReportRepository.findOverstayPayments(any())).thenReturn(List.of());

        builder = new OverdueDebtReportBuilder(contractReportRepository, bookingReportRepository, paymentReportRepository,
                new OverdueFeeCalculator(facilityPolicyRepository));
    }

    private User customer(String name, String email) {
        User user = User.builder().username("u" + UUID.randomUUID().toString().substring(0, 6)).fullName(name).email(email).phone("0900000001").build();
        user.setId(UUID.randomUUID());
        return user;
    }

    private StorageUnit unit(String code, UnitStatus status) {
        StorageUnit unit = new StorageUnit(code, "1", status, facility, null, new BigDecimal("1000000"));
        unit.setId(UUID.randomUUID());
        return unit;
    }

    private RentalContract contract(String code, RentalContractStatus status, int daysOverdue, StorageUnit unit, Booking booking) {
        RentalContract contract = RentalContract.builder()
                .contractCode(code)
                .customer(customer("Nguyen Van A", "a@example.com"))
                .unit(unit)
                .facility(facility)
                .booking(booking)
                .startDate(TODAY.minusDays(daysOverdue).minusMonths(6))
                .endDate(TODAY.minusDays(daysOverdue))
                .monthlyFee(new BigDecimal("1000000"))
                .status(status)
                .build();
        contract.setId(UUID.randomUUID());
        return contract;
    }

    @Test
    @DisplayName("Ledger asks for ACTIVE, OVERDUE, OVERDUE_LOCKED and EXPIRED contracts, so the nightly cron cannot hide a debt")
    @SuppressWarnings("unchecked")
    void queriesEveryOverdueContractStatus() {
        builder.build(null, TODAY);

        ArgumentCaptor<Collection<RentalContractStatus>> statuses = ArgumentCaptor.forClass(Collection.class);
        verify(contractReportRepository).findPastDue(statuses.capture(), any(), any());
        assertThat(statuses.getValue()).contains(
                RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE,
                RentalContractStatus.OVERDUE_LOCKED, RentalContractStatus.EXPIRED);
    }

    @Test
    @DisplayName("Money and stages follow the facility policy and the shared calculator")
    void figuresComeFromTheSharedCalculator() {
        RentalContract blocked = contract("CTR-1", RentalContractStatus.OVERDUE, 5, unit("A1", UnitStatus.OCCUPIED), null);
        when(contractReportRepository.findPastDue(any(), any(), any())).thenReturn(List.of(blocked));

        OverdueDebtReportResponse report = builder.build(null, TODAY);

        assertThat(report.getItems()).hasSize(1);
        OverdueDebtItemResponse item = report.getItems().get(0);
        assertThat(item.getDaysOverdue()).isEqualTo(5);
        assertThat(item.getOverdueStage()).isEqualTo("ACCESS_BLOCKED");
        // (5 days - 1 grace day) x 50.000, plus one monthly fee for the first 30-day block
        assertThat(item.getTotalLateFee()).isEqualByComparingTo("200000");
        assertThat(item.getUnpaidRent()).isEqualByComparingTo("1000000");
        assertThat(item.getTotalDebt()).isEqualByComparingTo("1200000");
        assertThat(item.getDailyLateFee()).isEqualByComparingTo("50000");
        assertThat(report.getTotalDebtAmount()).isEqualByComparingTo("1200000");
        assertThat(report.getAccessBlockedCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("Contracts still inside the grace window are listed but not counted as delinquent debt")
    void graceWindowDebtIsReportedSeparately() {
        RentalContract inGrace = contract("CTR-GRACE", RentalContractStatus.ACTIVE, 1, unit("A1", UnitStatus.OCCUPIED), null);
        RentalContract late = contract("CTR-LATE", RentalContractStatus.OVERDUE, 4, unit("A2", UnitStatus.OCCUPIED), null);
        when(contractReportRepository.findPastDue(any(), any(), any())).thenReturn(List.of(inGrace, late));

        OverdueDebtReportResponse report = builder.build(null, TODAY);

        assertThat(report.getTotalOverdueCount()).isEqualTo(2);
        assertThat(report.getGracePeriodCount()).isEqualTo(1);
        assertThat(report.getDelinquentCount()).isEqualTo(1);
        assertThat(report.getGracePeriodDebt()).isEqualByComparingTo("1000000");
        assertThat(report.getDelinquentDebtAmount()).isEqualByComparingTo("1150000");
        assertThat(report.getTotalDebtAmount()).isEqualByComparingTo("2150000");
    }

    @Test
    @DisplayName("Locked units are counted from the real state (unit, contract or revoked PIN), not from the day count")
    void lockedUnitsComeFromRealState() {
        RentalContract unitLocked = contract("CTR-U", RentalContractStatus.OVERDUE, 10, unit("L1", UnitStatus.OVERDUE_LOCKED), null);
        RentalContract sealed = contract("CTR-S", RentalContractStatus.OVERDUE_LOCKED, 30, unit("L2", UnitStatus.OVERDUE_LOCKED), null);
        Booking revoked = Booking.builder().bookingCode("BX-R").status(BookingStatus.OVERDUE).qrAccessToken("REVOKED_OVERDUE").build();
        revoked.setId(UUID.randomUUID());
        RentalContract pinRevoked = contract("CTR-P", RentalContractStatus.OVERDUE, 8, unit("L3", UnitStatus.OCCUPIED), revoked);
        RentalContract notLockedYet = contract("CTR-N", RentalContractStatus.ACTIVE, 9, unit("L4", UnitStatus.OCCUPIED), null);
        when(contractReportRepository.findPastDue(any(), any(), any())).thenReturn(List.of(unitLocked, sealed, pinRevoked, notLockedYet));

        OverdueDebtReportResponse report = builder.build(null, TODAY);

        assertThat(report.getLockedUnitCount()).isEqualTo(3);
        assertThat(report.getItems()).filteredOn(OverdueDebtItemResponse::isLocked).hasSize(3);
        assertThat(report.getItems()).filteredOn(item -> "CTR-S".equals(item.getContractCode()))
                .first().extracting(OverdueDebtItemResponse::getSmartLockStatus).isEqualTo("SEALED");
        assertThat(report.getItems()).filteredOn(item -> "CTR-N".equals(item.getContractCode()))
                .first().extracting(OverdueDebtItemResponse::getSmartLockStatus).isEqualTo("WARNING");
        // sealing stage is by days, independent of the lock state
        assertThat(report.getEligibleForSealingCount()).isEqualTo(4);
    }

    @Test
    @DisplayName("Money already paid for the overstay is subtracted: rent first, then the late fee")
    void paidAmountReducesTheDebt() {
        RentalContract contract = contract("CTR-PAID", RentalContractStatus.OVERDUE, 11, unit("P1", UnitStatus.OCCUPIED), null);
        when(contractReportRepository.findPastDue(any(), any(), any())).thenReturn(List.of(contract));
        // late fee = (11 - 1) x 50.000 = 500.000; rent = 1.000.000. Customer paid 1.200.000 after the due date
        // and 300.000 long before it (must be ignored).
        when(paymentReportRepository.findOverstayPayments(any())).thenReturn(List.of(
                new Object[]{contract.getId(), TODAY.minusDays(3).atStartOfDay(), new BigDecimal("1200000")},
                new Object[]{contract.getId(), TODAY.minusMonths(5).atStartOfDay(), new BigDecimal("300000")}));

        OverdueDebtItemResponse item = builder.build(null, TODAY).getItems().get(0);

        assertThat(item.getPaidAmount()).isEqualByComparingTo("1200000");
        assertThat(item.getUnpaidRent()).isEqualByComparingTo("0");
        assertThat(item.getTotalLateFee()).isEqualByComparingTo("300000");
        assertThat(item.getTotalDebt()).isEqualByComparingTo("300000");
    }

    @Test
    @DisplayName("A booking without a contract is reported with its real data only")
    void bookingWithoutContractUsesRealValues() {
        StorageUnit unit = unit("B1", UnitStatus.OCCUPIED);
        User holder = customer("Tran Thi B", "b@example.com");
        Booking booking = Booking.builder()
                .bookingCode("BX-NO-CONTRACT")
                .customer(holder)
                .storageUnit(unit)
                .startDate(TODAY.minusMonths(3).minusDays(5))
                .endDate(TODAY.minusDays(5))
                .rentalMonths(3)
                .totalRentalFee(new BigDecimal("3000000"))
                .status(BookingStatus.ACTIVE)
                .build();
        booking.setId(UUID.randomUUID());
        when(bookingReportRepository.findPastDueWithoutContract(any(), any(), any())).thenReturn(List.of(booking));

        OverdueDebtReportResponse report = builder.build(null, TODAY);

        assertThat(report.getItems()).hasSize(1);
        OverdueDebtItemResponse item = report.getItems().get(0);
        assertThat(item.getContractId()).isNull();
        assertThat(item.getContractCode()).isNull();
        assertThat(item.getBookingCode()).isEqualTo("BX-NO-CONTRACT");
        assertThat(item.getCustomerName()).isEqualTo("Tran Thi B");
        assertThat(item.getCustomerEmail()).isEqualTo("b@example.com");
        assertThat(item.getFacilityName()).isEqualTo("Boxora District 1");
        assertThat(item.getUnpaidRent()).isEqualByComparingTo("1000000");
    }

    @Test
    @DisplayName("A booking whose rent cannot be derived is skipped instead of being given an invented amount")
    void bookingWithoutPriceIsSkipped() {
        Booking booking = Booking.builder()
                .bookingCode("BX-NO-PRICE")
                .customer(customer("Le Van C", "c@example.com"))
                .storageUnit(unit("B2", UnitStatus.OCCUPIED))
                .startDate(TODAY.minusMonths(1))
                .endDate(TODAY.minusDays(2))
                .rentalMonths(1)
                .status(BookingStatus.ACTIVE)
                .build();
        booking.setId(UUID.randomUUID());
        when(bookingReportRepository.findPastDueWithoutContract(any(), any(), any())).thenReturn(List.of(booking));

        OverdueDebtReportResponse report = builder.build(null, TODAY);

        assertThat(report.getItems()).isEmpty();
        assertThat(report.getTotalDebtAmount()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("Missing customer data stays null: no placeholder name, phone or email")
    void missingCustomerDataIsNotInvented() {
        RentalContract contract = contract("CTR-NOCUST", RentalContractStatus.OVERDUE, 4, unit("N1", UnitStatus.OCCUPIED), null);
        contract.setCustomer(null);
        when(contractReportRepository.findPastDue(any(), any(), any())).thenReturn(List.of(contract));

        OverdueDebtItemResponse item = builder.build(null, TODAY).getItems().get(0);

        assertThat(item.getCustomerName()).isNull();
        assertThat(item.getCustomerPhone()).isNull();
        assertThat(item.getCustomerEmail()).isNull();
    }

    @Test
    @DisplayName("figuresFor returns null for a contract that is not overdue")
    void figuresForCurrentContractIsNull() {
        RentalContract current = contract("CTR-OK", RentalContractStatus.ACTIVE, -10, unit("C1", UnitStatus.OCCUPIED), null);
        current.setEndDate(TODAY.plusDays(10));

        assertThat(builder.figuresFor(current, TODAY)).isNull();
    }

    @Test
    @DisplayName("Payments with a null payment time are ignored when subtracting")
    void paymentsWithoutTimeAreIgnored() {
        RentalContract contract = contract("CTR-NT", RentalContractStatus.OVERDUE, 4, unit("T1", UnitStatus.OCCUPIED), null);
        when(contractReportRepository.findPastDue(any(), any(), any())).thenReturn(List.of(contract));
        LocalDateTime none = null;
        when(paymentReportRepository.findOverstayPayments(any())).thenReturn(List.<Object[]>of(
                new Object[]{contract.getId(), none, new BigDecimal("999999")}));

        assertThat(builder.build(null, TODAY).getItems().get(0).getPaidAmount()).isEqualByComparingTo("0");
    }
}
