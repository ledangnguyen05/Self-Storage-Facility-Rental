package com.boxora.service.impl;

import com.boxora.dto.response.ContractOutstandingResponse;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.mapper.PaymentMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RefundRequestRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.AccessRestorationService;
import com.boxora.service.ActivityLogService;
import com.boxora.service.ContractBillingService;
import com.boxora.service.ContractRenewalService;
import com.boxora.service.ContractSigningService;
import com.boxora.service.EmailService;
import com.boxora.service.OverdueFeeCalculator;
import com.boxora.service.StorageUnitLockService;
import com.boxora.service.VNPayService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * End-to-end (service level) reproduction of the QA finding "paying the outstanding rent through VNPay does not
 * reduce the debt": the customer opens the contract balance, pays it through VNPay (create the payment, then the
 * gateway return), and reads the balance again. A real {@link ContractBillingServiceImpl} computes the balance from an
 * in-memory payment ledger shared with {@link PaymentServiceImpl}.
 */
class OutstandingRentVnpayFlowTest {

    private static final String MONTHLY = "4800000";

    private final List<Payment> ledger = new ArrayList<>();
    private final PaymentRepository paymentRepository = mock(PaymentRepository.class);
    private final RentalContractRepository rentalContractRepository = mock(RentalContractRepository.class);
    private final BookingRepository bookingRepository = mock(BookingRepository.class);
    private final RequestContext requestContext = mock(RequestContext.class);
    private final VNPayService vnPayService = mock(VNPayService.class);
    private final OverdueFeeCalculator overdueFeeCalculator = mock(OverdueFeeCalculator.class);
    private final AccessRestorationService accessRestorationService = mock(AccessRestorationService.class);

    private PaymentServiceImpl payments;
    private ContractBillingServiceImpl billing;
    private User customer;
    private Facility facility;
    private final LocalDate today = LocalDate.now();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        ActivityLogService activityLogService = mock(ActivityLogService.class);
        FacilityAccessGuard facilityAccessGuard = mock(FacilityAccessGuard.class);
        ObjectProvider<AccessRestorationService> restorationProvider = mock(ObjectProvider.class);
        when(restorationProvider.getIfAvailable()).thenReturn(accessRestorationService);

        billing = new ContractBillingServiceImpl(rentalContractRepository, bookingRepository, paymentRepository,
                mock(StorageUnitRepository.class), mock(FacilityPolicyRepository.class), overdueFeeCalculator,
                restorationProvider, activityLogService, facilityAccessGuard, requestContext,
                mock(PlatformTransactionManager.class));

        ObjectProvider<ContractBillingService> billingProvider = mock(ObjectProvider.class);
        when(billingProvider.getObject()).thenReturn(billing);
        when(billingProvider.getIfAvailable()).thenReturn(billing);
        PaymentMapper paymentMapper = mock(PaymentMapper.class);
        when(paymentMapper.toResponse(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            return PaymentResponse.builder().id(p.getId()).transactionId(p.getTransactionId()).status(p.getStatus())
                    .amount(p.getAmount()).paymentType(p.getPaymentType()).build();
        });

        payments = new PaymentServiceImpl(paymentRepository, bookingRepository, paymentMapper, vnPayService,
                activityLogService, requestContext, facilityAccessGuard,
                (ObjectProvider<ContractRenewalService>) mock(ObjectProvider.class),
                (ObjectProvider<ContractSigningService>) mock(ObjectProvider.class),
                billingProvider,
                (ObjectProvider<EmailService>) mock(ObjectProvider.class),
                mock(StorageUnitLockService.class), rentalContractRepository, mock(RefundRequestRepository.class));

        customer = User.builder().email("customer@gmail.com").fullName("Khách thuê").build();
        customer.setId(UUID.randomUUID());
        facility = Facility.builder().name("Boxora Quận 1").build();
        facility.setId(UUID.randomUUID());

        // In-memory ledger shared by the payment service (writes) and the billing service (reads).
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) {
                p.setId(UUID.randomUUID());
            }
            if (!ledger.contains(p)) {
                ledger.add(p);
            }
            return p;
        });
        when(paymentRepository.findByTransactionId(anyString())).thenAnswer(inv -> ledger.stream()
                .filter(p -> Objects.equals(p.getTransactionId(), inv.getArgument(0))).findFirst());
        when(paymentRepository.findAllByBooking_Id(any())).thenAnswer(inv -> ledger.stream()
                .filter(p -> p.getBooking() != null && Objects.equals(p.getBooking().getId(), inv.getArgument(0))).toList());
        when(paymentRepository.findAllByContract_Id(any())).thenAnswer(inv -> ledger.stream()
                .filter(p -> p.getContract() != null && Objects.equals(p.getContract().getId(), inv.getArgument(0))).toList());
        when(paymentRepository.findAllByContract_IdAndStatusAndPaymentType(any(), any(), any())).thenAnswer(inv -> ledger.stream()
                .filter(p -> p.getContract() != null && Objects.equals(p.getContract().getId(), inv.getArgument(0))
                        && p.getStatus() == inv.getArgument(1) && p.getPaymentType() == inv.getArgument(2)).toList());

        when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), any()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        when(vnPayService.verifySignature(any())).thenReturn(true);

        lenient().when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        lenient().when(requestContext.currentUserId()).thenReturn(customer.getId());
        lenient().when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");
    }

    /** 3-month term at 4,800,000/month, deposit 4,800,000; the booking reads PAID without any payment row (seed / counter). */
    private RentalContract contract(RentalContractStatus status, LocalDate start, LocalDate end, int months, LocalDate checkIn) {
        StorageUnit unit = StorageUnit.builder().unitCode("D1-C209").facility(facility).build();
        unit.setId(UUID.randomUUID());
        Booking booking = Booking.builder()
                .bookingCode("BX-2026-C209QA")
                .customer(customer)
                .storageUnit(unit)
                .status(status == RentalContractStatus.ACTIVE ? BookingStatus.ACTIVE : BookingStatus.OVERDUE)
                .rentalMonths(months)
                .totalRentalFee(new BigDecimal(MONTHLY).multiply(BigDecimal.valueOf(months)))
                .depositAmount(new BigDecimal(MONTHLY))
                .depositPaid(new BigDecimal(MONTHLY))
                .paymentStatus("PAID")
                .startDate(start)
                .endDate(end)
                .handoverTime(checkIn.atTime(9, 0))
                .build();
        booking.setId(UUID.randomUUID());
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-BX-2026-C209QA")
                .customer(customer)
                .facility(facility)
                .unit(unit)
                .booking(booking)
                .startDate(start)
                .endDate(end)
                .monthlyFee(new BigDecimal(MONTHLY))
                .status(status)
                .build();
        contract.setId(UUID.randomUUID());
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        lenient().when(rentalContractRepository.findByBookingId(booking.getId())).thenReturn(Optional.of(contract));
        return contract;
    }

    /** Gateway return of VNPay for the payment that was just created. */
    private PaymentResponse vnpayReturn(VNPayPaymentResponse created, String responseCode) {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", created.getTransactionId());
        params.put("vnp_Amount", created.getAmount().multiply(BigDecimal.valueOf(100)).toBigInteger().toString());
        params.put("vnp_ResponseCode", responseCode);
        params.put("vnp_TransactionStatus", "00".equals(responseCode) ? "00" : "02");
        return payments.processVNPayReturn(params);
    }

    @Test
    @DisplayName("QA repro D1-C209: paying the outstanding 4.800.000 ₫ through VNPay clears the debt")
    void payingOutstandingRentClearsTheDebt() {
        LocalDate start = today.minusMonths(1);
        RentalContract contract = contract(RentalContractStatus.ACTIVE, start, start.plusMonths(3), 3, start);

        ContractOutstandingResponse before = billing.getOutstanding(contract.getId());
        assertThat(before.getBilledMonths()).isEqualTo(2);
        assertThat(before.getTotalDueNow()).isEqualByComparingTo(MONTHLY);

        VNPayPaymentResponse created = payments.createOutstandingPayment(contract.getId(), 0, null);
        assertThat(created.getAmount()).isEqualByComparingTo(MONTHLY);
        PaymentResponse result = vnpayReturn(created, "00");
        assertThat(result.getStatus()).isEqualTo(PaymentStatus.PAID);

        ContractOutstandingResponse after = billing.getOutstanding(contract.getId());
        assertThat(after.getRentPaid()).isEqualByComparingTo("9600000");
        assertThat(after.getRentOutstanding()).isEqualByComparingTo("0");
        assertThat(after.getTotalDueNow()).isEqualByComparingTo("0");
        assertThat(after.getNextRentDueDate()).isEqualTo(start.plusMonths(2));
    }

    @Test
    @DisplayName("Paying a month ahead on the check-in day itself is credited as a later month, not as the first one")
    void payingAheadOnTheCheckInDayIsCredited() {
        RentalContract contract = contract(RentalContractStatus.ACTIVE, today, today.plusMonths(3), 3, today);

        ContractOutstandingResponse before = billing.getOutstanding(contract.getId());
        assertThat(before.getTotalDueNow()).isEqualByComparingTo("0");
        assertThat(before.getRemainingTermMonths()).isEqualTo(2);

        VNPayPaymentResponse created = payments.createOutstandingPayment(contract.getId(), 1, null);
        assertThat(created.getAmount()).isEqualByComparingTo(MONTHLY);
        vnpayReturn(created, "00");

        ContractOutstandingResponse after = billing.getOutstanding(contract.getId());
        assertThat(after.getRentPaid()).isEqualByComparingTo("9600000");
        assertThat(after.getRemainingTermMonths()).isEqualTo(1);
        assertThat(after.getNextRentDueDate()).isEqualTo(today.plusMonths(2));
    }

    @Test
    @DisplayName("Settling an overdue contract through VNPay extends the term and restores access")
    void settlingAnOverdueContractRestoresAccess() {
        LocalDate oldEnd = today.minusDays(5);
        RentalContract contract = contract(RentalContractStatus.OVERDUE, oldEnd.minusMonths(1), oldEnd, 1, oldEnd.minusMonths(1));
        when(overdueFeeCalculator.daysOverdue(eq(contract), any())).thenReturn(5);
        when(overdueFeeCalculator.calculateLateFee(eq(contract), any())).thenReturn(new BigDecimal("250000"));
        when(overdueFeeCalculator.calculateOverdueRent(eq(contract), any())).thenReturn(new BigDecimal(MONTHLY));

        ContractOutstandingResponse before = billing.getOutstanding(contract.getId());
        assertThat(before.getTotalDueNow()).isEqualByComparingTo("5050000");

        VNPayPaymentResponse created = payments.createOutstandingPayment(contract.getId(), 0, null);
        vnpayReturn(created, "00");

        assertThat(contract.getEndDate()).isEqualTo(oldEnd.plusDays(OverdueFeeCalculator.RENT_BLOCK_DAYS));
        assertThat(contract.getBooking().getEndDate()).isEqualTo(contract.getEndDate());
        verify(accessRestorationService).restoreAccessAfterSettlement(eq(contract.getId()), anyString());
        assertThat(billing.getOutstanding(contract.getId()).getTotalDueNow()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("A refused VNPay payment (insufficient funds) is FAILED and leaves the debt and the access untouched")
    void failedVnpayPaymentDoesNotCreditTheDebt() {
        LocalDate oldEnd = today.minusDays(5);
        RentalContract contract = contract(RentalContractStatus.OVERDUE, oldEnd.minusMonths(1), oldEnd, 1, oldEnd.minusMonths(1));
        when(overdueFeeCalculator.daysOverdue(eq(contract), any())).thenReturn(5);
        when(overdueFeeCalculator.calculateLateFee(eq(contract), any())).thenReturn(new BigDecimal("250000"));
        when(overdueFeeCalculator.calculateOverdueRent(eq(contract), any())).thenReturn(new BigDecimal(MONTHLY));

        VNPayPaymentResponse created = payments.createOutstandingPayment(contract.getId(), 0, null);
        PaymentResponse result = vnpayReturn(created, "51");

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(ledger).singleElement().satisfies(p -> {
            assertThat(p.getPaymentType()).isEqualTo(PaymentType.RENTAL_FEE);
            assertThat(p.getGatewayResponseCode()).isEqualTo("51");
        });
        assertThat(contract.getEndDate()).isEqualTo(oldEnd);
        verify(accessRestorationService, never()).restoreAccessAfterSettlement(any(), anyString());
        assertThat(billing.getOutstanding(contract.getId()).getTotalDueNow()).isEqualByComparingTo("5050000");
    }
}
