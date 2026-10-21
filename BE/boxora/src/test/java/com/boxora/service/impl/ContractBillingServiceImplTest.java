package com.boxora.service.impl;

import com.boxora.dto.response.ContractOutstandingResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.AccessRestorationService;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractBillingService;
import com.boxora.service.OverdueFeeCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Rent billing after check-in: what is due now, overdue settlement, renewal window. */
@ExtendWith(MockitoExtension.class)
class ContractBillingServiceImplTest {

    @Mock
    private RentalContractRepository rentalContractRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private StorageUnitRepository storageUnitRepository;
    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;
    @Mock
    private OverdueFeeCalculator overdueFeeCalculator;
    @Mock
    private ObjectProvider<AccessRestorationService> accessRestorationServiceProvider;
    @Mock
    private AccessRestorationService accessRestorationService;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private FacilityAccessGuard facilityAccessGuard;
    @Mock
    private RequestContext requestContext;
    @Mock
    private PlatformTransactionManager transactionManager;

    private ContractBillingServiceImpl billing;
    private final LocalDate today = LocalDate.now();
    private User customer;
    private Facility facility;

    @BeforeEach
    void setUp() {
        billing = new ContractBillingServiceImpl(rentalContractRepository, bookingRepository, paymentRepository, storageUnitRepository,
                facilityPolicyRepository, overdueFeeCalculator, accessRestorationServiceProvider, activityLogService,
                facilityAccessGuard, requestContext, transactionManager);
        customer = User.builder().email("customer@gmail.com").fullName("Khách thuê").build();
        customer.setId(UUID.randomUUID());
        facility = Facility.builder().name("Boxora Quận 1").build();
        facility.setId(UUID.randomUUID());
    }

    /** 3-month term at 1,000,000/month (discounted total 3,000,000), deposit 1,000,000. */
    private RentalContract contract(RentalContractStatus status, LocalDate start, LocalDate end, int months) {
        StorageUnit unit = StorageUnit.builder().unitCode("A-101").facility(facility).build();
        unit.setId(UUID.randomUUID());
        Booking booking = Booking.builder()
                .bookingCode("BX-2026-ABCDEF")
                .customer(customer)
                .storageUnit(unit)
                .status(status == RentalContractStatus.ACTIVE ? BookingStatus.ACTIVE : BookingStatus.OVERDUE)
                .rentalMonths(months)
                .totalRentalFee(new BigDecimal(months).multiply(new BigDecimal("1000000")))
                .depositAmount(new BigDecimal("1000000"))
                .depositPaid(new BigDecimal("1000000"))
                .paymentStatus("PAID")
                .startDate(start)
                .endDate(end)
                .build();
        booking.setId(UUID.randomUUID());
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-BX-2026-ABCDEF")
                .customer(customer)
                .facility(facility)
                .unit(unit)
                .booking(booking)
                .startDate(start)
                .endDate(end)
                .monthlyFee(new BigDecimal("1200000"))
                .status(status)
                .build();
        contract.setId(UUID.randomUUID());
        return contract;
    }

    private Payment paid(PaymentType type, String amount) {
        Payment payment = Payment.builder().paymentType(type).status(PaymentStatus.PAID).amount(new BigDecimal(amount)).build();
        payment.setId(UUID.randomUUID());
        return payment;
    }

    @Test
    void secondMonthRentIsDueAfterTheFirstPeriodAndUsesTheDiscountedRent() {
        LocalDate start = today.minusDays(40);
        RentalContract contract = contract(RentalContractStatus.ACTIVE, start, start.plusMonths(3), 3);
        // Online booking payment = first month + deposit.
        when(paymentRepository.findAllByBooking_Id(contract.getBooking().getId()))
                .thenReturn(List.of(paid(PaymentType.BOOKING_PAYMENT, "2000000")));

        ContractOutstandingResponse due = billing.computeOutstanding(contract, today);

        assertThat(due.getMonthlyRent()).isEqualByComparingTo("1000000"); // booking total / months, not the list price
        assertThat(due.getBilledMonths()).isEqualTo(2);
        assertThat(due.getRentPaid()).isEqualByComparingTo("1000000");
        assertThat(due.getRentOutstanding()).isEqualByComparingTo("1000000");
        assertThat(due.getTotalDueNow()).isEqualByComparingTo("1000000");
        assertThat(due.getRemainingTermMonths()).isEqualTo(1);
        assertThat(due.isCanPayOnline()).isTrue();
        assertThat(due.isOverdue()).isFalse();
        assertThat(due.getItems()).extracting(ContractOutstandingResponse.Item::getCode).containsExactly("RENT_OUTSTANDING");
    }

    @Test
    void overdueContractOwesLateFeeAndOverdueRentFromTheOverdueRule() {
        LocalDate start = today.minusMonths(1).minusDays(5);
        RentalContract contract = contract(RentalContractStatus.OVERDUE, start, today.minusDays(5), 1);
        when(paymentRepository.findAllByBooking_Id(contract.getBooking().getId()))
                .thenReturn(List.of(paid(PaymentType.BOOKING_PAYMENT, "2000000")));
        when(overdueFeeCalculator.daysOverdue(contract, today)).thenReturn(5);
        when(overdueFeeCalculator.calculateLateFee(contract, today)).thenReturn(new BigDecimal("200000"));
        when(overdueFeeCalculator.calculateOverdueRent(contract, today)).thenReturn(new BigDecimal("1000000"));

        ContractOutstandingResponse due = billing.computeOutstanding(contract, today);

        assertThat(due.isOverdue()).isTrue();
        assertThat(due.getRentOutstanding()).isEqualByComparingTo("0");
        assertThat(due.getLateFee()).isEqualByComparingTo("200000");
        assertThat(due.getOverdueRent()).isEqualByComparingTo("1000000");
        assertThat(due.getTotalDueNow()).isEqualByComparingTo("1200000");
        assertThat(due.getExtensionDays()).isEqualTo(OverdueFeeCalculator.RENT_BLOCK_DAYS);
        assertThat(due.getPaidThroughAfterSettlement()).isEqualTo(today.minusDays(5).plusDays(OverdueFeeCalculator.RENT_BLOCK_DAYS));
        assertThat(due.isCanPayOnline()).isTrue();
    }

    /**
     * QA repro (D1-C209): booking marked PAID at check-in without any payment row, monthly rent 4,800,000, two
     * periods billed; the customer pays the outstanding 4,800,000 through VNPay. The debt must drop to 0.
     */
    @Test
    void rentPaidOnlineAfterCheckInIsAddedToTheAssumedFirstMonth() {
        LocalDate start = today.minusMonths(1);
        RentalContract contract = contract(RentalContractStatus.ACTIVE, start, start.plusMonths(3), 3);
        Booking booking = contract.getBooking();
        booking.setTotalRentalFee(new BigDecimal("14400000"));
        booking.setHandoverTime(start.atTime(9, 0));
        when(paymentRepository.findAllByBooking_Id(booking.getId())).thenReturn(List.of());
        when(paymentRepository.findAllByContract_Id(contract.getId())).thenReturn(List.of());

        ContractOutstandingResponse before = billing.computeOutstanding(contract, today);
        assertThat(before.getMonthlyRent()).isEqualByComparingTo("4800000");
        assertThat(before.getBilledMonths()).isEqualTo(2);
        assertThat(before.getTotalDueNow()).isEqualByComparingTo("4800000");

        Payment rent = paid(PaymentType.RENTAL_FEE, "4800000");
        rent.setContract(contract);
        rent.setBooking(booking);
        rent.setPaymentTime(today.atTime(10, 15));
        when(paymentRepository.findAllByBooking_Id(booking.getId())).thenReturn(List.of(rent));
        when(paymentRepository.findAllByContract_Id(contract.getId())).thenReturn(List.of(rent));

        ContractOutstandingResponse after = billing.computeOutstanding(contract, today);
        assertThat(after.getRentPaid()).isEqualByComparingTo("9600000");
        assertThat(after.getRentOutstanding()).isEqualByComparingTo("0");
        assertThat(after.getTotalDueNow()).isEqualByComparingTo("0");
        assertThat(after.getNextRentDueDate()).isEqualTo(start.plusMonths(2));
    }

    @Test
    void rentCollectedAtTheCounterOnTheCheckInDayIsTheFirstMonthNotAnExtraOne() {
        LocalDate start = today.minusMonths(1);
        RentalContract contract = contract(RentalContractStatus.ACTIVE, start, start.plusMonths(3), 3);
        Booking booking = contract.getBooking();
        booking.setHandoverTime(start.atTime(9, 0));
        // Seeded / counter payment of the first month, recorded against the contract on the check-in day.
        Payment firstMonth = paid(PaymentType.RENTAL_FEE, "1000000");
        firstMonth.setContract(contract);
        firstMonth.setPaymentTime(start.atTime(9, 30));
        when(paymentRepository.findAllByBooking_Id(booking.getId())).thenReturn(List.of(firstMonth));
        when(paymentRepository.findAllByContract_Id(contract.getId())).thenReturn(List.of(firstMonth));

        ContractOutstandingResponse due = billing.computeOutstanding(contract, today);

        assertThat(due.getRentPaid()).isEqualByComparingTo("1000000");
        assertThat(due.getTotalDueNow()).isEqualByComparingTo("1000000");
    }

    /**
     * Overdue 2-month contract whose first month was paid at check-in without a payment row: the settlement pays
     * the unpaid 2nd month + late fee + overdue rent. Before the fix the 2nd month replaced the assumed first month,
     * 1,000,000 stayed "due" and access was never restored.
     */
    @Test
    void settlingAnOverdueContractWithoutBookingPaymentRowRestoresAccess() {
        LocalDate oldEnd = today.minusDays(5);
        LocalDate start = oldEnd.minusMonths(2);
        RentalContract contract = contract(RentalContractStatus.OVERDUE, start, oldEnd, 2);
        Booking booking = contract.getBooking();
        booking.setHandoverTime(start.atTime(9, 0));
        Payment settlement = paid(PaymentType.RENTAL_FEE, "2200000");
        settlement.setContract(contract);
        settlement.setBooking(booking);
        settlement.setTransactionId("BOX-OVD");
        settlement.setPaymentTime(today.atTime(11, 0));
        settlement.setLateFeeAmount(new BigDecimal("200000"));
        settlement.setOverdueRentAmount(new BigDecimal("1000000"));
        settlement.setExtensionDays(OverdueFeeCalculator.RENT_BLOCK_DAYS);
        when(paymentRepository.findAllByBooking_Id(booking.getId())).thenReturn(List.of(settlement));
        when(paymentRepository.findAllByContract_Id(contract.getId())).thenReturn(List.of(settlement));
        when(accessRestorationServiceProvider.getIfAvailable()).thenReturn(accessRestorationService);

        billing.applyRentalPayment(settlement);

        assertThat(contract.getEndDate()).isEqualTo(oldEnd.plusDays(OverdueFeeCalculator.RENT_BLOCK_DAYS));
        verify(accessRestorationService).restoreAccessAfterSettlement(eq(contract.getId()), anyString());
    }

    @Test
    void contractNotStartedCannotBePaidHere() {
        RentalContract contract = contract(RentalContractStatus.PENDING_ACTIVATION, today.plusDays(3), today.plusDays(3).plusMonths(3), 3);

        ContractOutstandingResponse due = billing.computeOutstanding(contract, today);

        assertThat(due.isCanPayOnline()).isFalse();
        assertThat(due.getBlockedReason()).contains("chưa bắt đầu");
        assertThat(due.getTotalDueNow()).isEqualByComparingTo("0");
    }

    @Test
    void paidOverdueSettlementExtendsContractAndBookingAndRestoresAccess() {
        LocalDate oldEnd = today.minusDays(5);
        RentalContract contract = contract(RentalContractStatus.OVERDUE, oldEnd.minusMonths(1), oldEnd, 1);
        when(paymentRepository.findAllByBooking_Id(contract.getBooking().getId()))
                .thenReturn(List.of(paid(PaymentType.BOOKING_PAYMENT, "2000000")));
        when(accessRestorationServiceProvider.getIfAvailable()).thenReturn(accessRestorationService);
        Payment settlement = paid(PaymentType.RENTAL_FEE, "1200000");
        settlement.setContract(contract);
        settlement.setTransactionId("BOX123");
        settlement.setLateFeeAmount(new BigDecimal("200000"));
        settlement.setOverdueRentAmount(new BigDecimal("1000000"));
        settlement.setExtensionDays(OverdueFeeCalculator.RENT_BLOCK_DAYS);

        billing.applyRentalPayment(settlement);

        LocalDate newEnd = oldEnd.plusDays(OverdueFeeCalculator.RENT_BLOCK_DAYS);
        assertThat(contract.getEndDate()).isEqualTo(newEnd);
        assertThat(contract.getBooking().getEndDate()).isEqualTo(newEnd);
        verify(rentalContractRepository).save(contract);
        verify(bookingRepository).save(contract.getBooking());
        verify(accessRestorationService).restoreAccessAfterSettlement(eq(contract.getId()), anyString());
    }

    @Test
    void renewalWindowFollowsFacilityPolicy() {
        LocalDate end = today.plusDays(10);
        RentalContract contract = contract(RentalContractStatus.ACTIVE, end.minusMonths(1), end, 1);
        FacilityPolicy policy = FacilityPolicy.builder().facility(facility).renewalWindowDays(7).build();
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId())).thenReturn(Optional.of(policy));

        ContractBillingService.RenewalWindow early = billing.renewalWindow(contract, today);
        assertThat(early.renewable()).isFalse();
        assertThat(early.opensOn()).isEqualTo(end.minusDays(7));
        assertThat(early.windowDays()).isEqualTo(7);
        assertThat(early.blockedReason()).contains("Bạn có thể gia hạn từ ngày");

        ContractBillingService.RenewalWindow inside = billing.renewalWindow(contract, end.minusDays(2));
        assertThat(inside.renewable()).isTrue();
    }

    @Test
    void overdueContractCanAlwaysBeRenewedButNotWhileReturning() {
        RentalContract overdue = contract(RentalContractStatus.OVERDUE_LOCKED, today.minusMonths(2), today.minusDays(20), 1);
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(any())).thenReturn(Optional.empty());

        assertThat(billing.renewalWindow(overdue, today).renewable()).isTrue();

        overdue.getBooking().setStatus(BookingStatus.CHECKOUT_REQUESTED);
        ContractBillingService.RenewalWindow returning = billing.renewalWindow(overdue, today);
        assertThat(returning.renewable()).isFalse();
        assertThat(returning.blockedReason()).contains("trả kho");
    }

    @Test
    void customerCannotReadAnotherCustomersBalance() {
        RentalContract contract = contract(RentalContractStatus.ACTIVE, today.minusDays(3), today.plusMonths(1), 1);
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());

        AppException error = assertThrows(AppException.class, () -> billing.getOutstanding(contract.getId()));
        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void depositCollectedOnTheBookingIsCopiedToTheContract() {
        RentalContract contract = contract(RentalContractStatus.ACTIVE, today, today.plusMonths(1), 1);
        contract.setDepositHeld(BigDecimal.ZERO);
        when(rentalContractRepository.findByBookingId(contract.getBooking().getId())).thenReturn(Optional.of(contract));

        billing.syncContractDeposit(contract.getBooking());

        assertThat(contract.getDepositHeld()).isEqualByComparingTo("1000000");
        verify(rentalContractRepository).save(contract);
    }
}
