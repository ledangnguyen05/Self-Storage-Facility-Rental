package com.boxora.service;

import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.BookingStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.PaymentMapper;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.EmailService;
import com.boxora.service.impl.PaymentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PaymentMapper paymentMapper;

    @Mock
    private VNPayService vnPayService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private RequestContext requestContext;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private com.boxora.security.FacilityAccessGuard facilityAccessGuard;

    @Mock
    private org.springframework.beans.factory.ObjectProvider<ContractRenewalService> contractRenewalServiceProvider;

    @Mock
    private com.boxora.service.StorageUnitLockService storageUnitLockService;

    @Mock
    private com.boxora.repository.RefundRequestRepository refundRequestRepository;

    @Mock
    private com.boxora.config.DocuSealConfig docuSealConfig;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    private Booking mockBooking;
    private Payment mockPayment;
    private UUID bookingId;
    private UUID paymentId;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        paymentId = UUID.randomUUID();

        mockBooking = Booking.builder()
                .bookingCode("BK-2026-001")
                .status(BookingStatus.PENDING_PAYMENT)
                .signingMethod("IN_PERSON")
                .depositPaid(BigDecimal.ZERO)
                .totalRentalFee(new BigDecimal("1000000"))
                .build();
        mockBooking.setId(bookingId);

        mockPayment = Payment.builder()
                .transactionId("BOX123456789")
                .booking(mockBooking)
                .amount(new BigDecimal("500000"))
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.PENDING)
                .paymentMethod("VNPAY")
                .paymentTime(LocalDateTime.now())
                .build();
        mockPayment.setId(paymentId);

        lenient().when(bookingRepository.findByIdForUpdate(any())).thenReturn(Optional.of(mockBooking));
        lenient().when(paymentRepository.findByTransactionIdForUpdate(anyString()))
                .thenAnswer(invocation -> paymentRepository.findByTransactionId(invocation.getArgument(0)));
    }

    @Test
    @DisplayName("createVNPayPayment should create PENDING payment and return checkout URL")
    void testCreateVNPayPaymentSuccess() {
        PaymentCreateRequest request = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.DEPOSIT)
                .amount(new BigDecimal("500000"))
                .orderInfo("Thanh toan tien coc")
                .build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment p = invocation.getArgument(0);
            p.setId(paymentId);
            return p;
        });
        when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=BOX123");

        VNPayPaymentResponse response = paymentService.createVNPayPayment(request, null);

        assertThat(response).isNotNull();
        assertThat(response.getPaymentUrl()).contains("vpcpay.html");
        assertThat(response.getAmount()).isEqualByComparingTo("500000");
        assertThat(response.getBookingId()).isEqualTo(bookingId);

        verify(paymentRepository).save(any(Payment.class));
        verify(activityLogService).record(nullable(UUID.class), eq(ActivityAction.PAYMENT_INITIATED), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("createVNPayPayment should throw BOOKING_NOT_FOUND when booking does not exist")
    void testCreateVNPayPaymentBookingNotFound() {
        PaymentCreateRequest request = PaymentCreateRequest.builder()
                .bookingId(UUID.randomUUID())
                .paymentType(PaymentType.DEPOSIT)
                .amount(new BigDecimal("500000"))
                .build();

        when(bookingRepository.findById(any())).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(request, null));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_FOUND);
    }

    @Test
    @DisplayName("Online booking payment is created directly before contract signing")
    void onlineBookingPaymentAllowedBeforeContractSigning() {
        mockBooking.setSigningMethod("ONLINE");
        mockBooking.setPaymentExpiresAt(java.time.Instant.now().plusSeconds(900));
        mockBooking.setDepositAmount(new BigDecimal("500000"));
        mockBooking.setRentalMonths(1);

        PaymentCreateRequest request = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .amount(new BigDecimal("1500000"))
                .build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of());
        when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment p = invocation.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });
        when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");

        VNPayPaymentResponse response = paymentService.createVNPayPayment(request, null);

        assertThat(response.getAmount()).isEqualByComparingTo("1500000");
        verify(paymentRepository).save(any(Payment.class));
    }

    @Test
    @DisplayName("processVNPayReturn should update Payment to PAID and Booking to CONFIRMED on code 00")
    void testProcessVNPayReturnSuccess() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");
        params.put("vnp_Amount", "50000000");
        params.put("vnp_PayDate", "20260922203000");

        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse mockResponse = PaymentResponse.builder()
                .id(paymentId)
                .transactionId("BOX123456789")
                .bookingId(bookingId)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("500000"))
                .build();
        when(paymentMapper.toResponse(any(Payment.class))).thenReturn(mockResponse);

        PaymentResponse result = paymentService.processVNPayReturn(params);

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(mockPayment.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(mockBooking.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(mockBooking.getDepositPaid()).isEqualByComparingTo("500000");

        verify(bookingRepository).save(mockBooking);
        verify(paymentRepository).save(mockPayment);
        verify(activityLogService).record(nullable(UUID.class), eq(ActivityAction.PAYMENT_CONFIRMED), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("processVNPayReturn should throw INVALID_PAYMENT_SIGNATURE when hash does not match")
    void testProcessVNPayReturnInvalidSignature() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        when(vnPayService.verifySignature(params)).thenReturn(false);

        AppException ex = assertThrows(AppException.class, () -> paymentService.processVNPayReturn(params));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_PAYMENT_SIGNATURE);
    }

    @Test
    @DisplayName("VNPay callback without a signed amount is not accepted as a payment result")
    void processVNPayReturnRejectsMissingAmount() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");
        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));

        AppException exception = assertThrows(AppException.class, () -> paymentService.processVNPayReturn(params));

        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
        assertThat(mockPayment.getStatus()).isEqualTo(PaymentStatus.PENDING);
    }

    @Test
    @DisplayName("processVNPayReturn should mark Payment as FAILED when responseCode is not 00")
    void testProcessVNPayReturnFailure() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_ResponseCode", "24"); // Cancelled by customer
        params.put("vnp_TransactionStatus", "02");
        params.put("vnp_Amount", "50000000");

        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        paymentService.processVNPayReturn(params);

        assertThat(mockPayment.getStatus()).isEqualTo(PaymentStatus.FAILED);
        verify(activityLogService).record(nullable(UUID.class), eq(ActivityAction.PAYMENT_FAILED), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("processVNPayIPN should return correct RspCode for checksum error, amount mismatch, and success")
    void testProcessVNPayIPN() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_Amount", "50000000");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");

        // 1. Invalid signature
        when(vnPayService.verifySignature(params)).thenReturn(false);
        VNPayIpnResponse ipnInvalidSign = paymentService.processVNPayIPN(params);
        assertThat(ipnInvalidSign.getRspCode()).isEqualTo("97");

        // 2. Order not found
        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.empty());
        VNPayIpnResponse ipnNotFound = paymentService.processVNPayIPN(params);
        assertThat(ipnNotFound.getRspCode()).isEqualTo("01");

        // 3. Amount mismatch
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));
        params.put("vnp_Amount", "99900000"); // 999,000 VND instead of 500,000 VND
        VNPayIpnResponse ipnAmountMismatch = paymentService.processVNPayIPN(params);
        assertThat(ipnAmountMismatch.getRspCode()).isEqualTo("04");

        // 4. Success
        params.put("vnp_Amount", "50000000");
        VNPayIpnResponse ipnSuccess = paymentService.processVNPayIPN(params);
        assertThat(ipnSuccess.getRspCode()).isEqualTo("00");
        assertThat(mockPayment.getStatus()).isEqualTo(PaymentStatus.PAID);
    }

    @Test
    @DisplayName("Race condition: VNPay return arriving after booking expiration/cancellation should flag REFUND_PENDING")
    void testProcessVNPayReturn_RaceWithExpiration_BookingCancelled_FlagsRefundPending() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_Amount", "50000000");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");

        mockBooking.setStatus(BookingStatus.CANCELLED);

        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));
        when(bookingRepository.findByIdForUpdate(mockBooking.getId())).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        paymentService.processVNPayReturn(params);

        assertThat(mockPayment.getStatus()).isEqualTo(PaymentStatus.REFUND_PENDING);
        assertThat(mockBooking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
    }

    @Test
    @DisplayName("Race condition: VNPay IPN arriving after booking expiration/cancellation should flag REFUND_PENDING and return 00")
    void testProcessVNPayIPN_RaceWithExpiration_BookingCancelled_FlagsRefundPending() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_Amount", "50000000");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");

        mockBooking.setStatus(BookingStatus.CANCELLED);

        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));
        when(bookingRepository.findByIdForUpdate(mockBooking.getId())).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        VNPayIpnResponse ipnResponse = paymentService.processVNPayIPN(params);

        assertThat(ipnResponse.getRspCode()).isEqualTo("00");
        assertThat(mockPayment.getStatus()).isEqualTo(PaymentStatus.REFUND_PENDING);
        assertThat(mockBooking.getStatus()).isEqualTo(BookingStatus.CANCELLED);
    }

    @Test
    @DisplayName("getByBookingId: Chủ sở hữu booking được phép xem lịch sử thanh toán thành công")
    void getByBookingId_AuthorizedOwner_ReturnsPayments() {
        com.boxora.entity.User customer = com.boxora.entity.User.builder().email("customer@boxora.vn").build();
        customer.setId(UUID.randomUUID());
        mockBooking.setCustomer(customer);

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(customer.getId());
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of(mockPayment));
        when(paymentMapper.toResponse(mockPayment)).thenReturn(PaymentResponse.builder().id(paymentId).build());

        java.util.List<PaymentResponse> results = paymentService.getByBookingId(bookingId);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getId()).isEqualTo(paymentId);
    }

    @Test
    @DisplayName("getByBookingId: Khách hàng khác xem thanh toán của người khác -> Bị từ chối FORBIDDEN (403)")
    void getByBookingId_UnauthorizedCustomer_ThrowsForbidden() {
        com.boxora.entity.User customer = com.boxora.entity.User.builder().email("customer@boxora.vn").build();
        customer.setId(UUID.randomUUID());
        mockBooking.setCustomer(customer);

        UUID attackerId = UUID.randomUUID();
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(attackerId);

        assertThrows(AppException.class, () -> paymentService.getByBookingId(bookingId));
    }

    @Test
    @DisplayName("getByBookingId: Nhân viên cơ sở khác xem thanh toán ngoài phạm vi -> Bị từ chối FACILITY_ACCESS_DENIED (403)")
    void getByBookingId_OutOfScopeStaff_ThrowsFacilityAccessDenied() {
        UUID facilityId = UUID.randomUUID();
        com.boxora.entity.Facility facility = com.boxora.entity.Facility.builder().name("Chi nhánh A").build();
        facility.setId(facilityId);
        com.boxora.entity.StorageUnit unit = com.boxora.entity.StorageUnit.builder().facility(facility).build();
        mockBooking.setStorageUnit(unit);

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED)).when(facilityAccessGuard).checkFacilityAccess(facilityId);

        assertThrows(AppException.class, () -> paymentService.getByBookingId(bookingId));
    }

    @Test
    @DisplayName("Task 09 Case 1: New UNPAID booking creates BOOKING_PAYMENT for full initial obligation (deposit + 1st month rent)")
    void testTask09_Case1_NewUnpaidBooking_CreatesFullInitialObligation() {
        mockBooking.setDepositAmount(new BigDecimal("500000"));
        mockBooking.setTotalRentalFee(new BigDecimal("3000000"));
        mockBooking.setRentalMonths(3); // 1,000,000 / month -> initial obligation = 1,500,000
        mockBooking.setPaymentExpiresAt(java.time.Instant.now().plusSeconds(900));

        PaymentCreateRequest request = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .amount(new BigDecimal("1500000"))
                .build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of());
        when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });
        when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");

        VNPayPaymentResponse response = paymentService.createVNPayPayment(request, null);
        assertThat(response.getAmount()).isEqualByComparingTo("1500000");
    }

    @Test
    @DisplayName("Task 09 Case 2: Booking with only DEPOSIT paid has paymentStatus PARTIALLY_PAID, not PAID")
    void testTask09_Case2_DepositOnlyPaid_MarksPartiallyPaid() {
        mockBooking.setDepositAmount(new BigDecimal("500000"));
        mockBooking.setTotalRentalFee(new BigDecimal("1000000"));
        mockBooking.setRentalMonths(1);

        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");
        params.put("vnp_Amount", "50000000");

        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of(mockPayment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentMapper.toResponse(any(Payment.class))).thenReturn(PaymentResponse.builder().status(PaymentStatus.PAID).build());

        paymentService.processVNPayReturn(params);

        assertThat(mockBooking.getPaymentStatus()).isEqualTo("PARTIALLY_PAID");
        assertThat(mockBooking.getDepositPaid()).isEqualByComparingTo("500000");
    }

    @Test
    @DisplayName("Task 09 Case 3 & 13: Booking with DEPOSIT already paid charges ONLY remaining RENTAL_FEE and ignores manipulated client amount")
    void testTask09_Case3_And_13_PartialDepositPaid_ChargesOnlyRemainingRentAndIgnoresClientAmount() {
        mockBooking.setStatus(BookingStatus.CONFIRMED);
        mockBooking.setPaymentStatus("PARTIALLY_PAID");
        mockBooking.setDepositAmount(new BigDecimal("500000"));
        mockBooking.setDepositPaid(new BigDecimal("500000"));
        mockBooking.setTotalRentalFee(new BigDecimal("1000000"));
        mockBooking.setRentalMonths(1);

        Payment confirmedDeposit = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("500000"))
                .build();
        confirmedDeposit.setId(UUID.randomUUID());

        // Client erroneously sends BOOKING_PAYMENT with full 1,500,000 (or manipulated 100,000)
        PaymentCreateRequest request = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .amount(new BigDecimal("1500000"))
                .build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of(confirmedDeposit));
        when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");

        final Payment[] savedHolder = new Payment[1];
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(UUID.randomUUID());
            savedHolder[0] = p;
            return p;
        });
        when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");

        VNPayPaymentResponse response = paymentService.createVNPayPayment(request, null);

        assertThat(response.getAmount()).isEqualByComparingTo("1000000");
        assertThat(savedHolder[0].getPaymentType()).isEqualTo(PaymentType.RENTAL_FEE);
        assertThat(savedHolder[0].getAmount()).isEqualByComparingTo("1000000");
    }

    @Test
    @DisplayName("Task 09 Case 9: Repeated clicks on createVNPayPayment reuse active PENDING transaction instead of creating duplicates")
    void testTask09_Case9_RepeatedCreatePayment_ReusesActivePendingPayment() {
        mockBooking.setDepositAmount(new BigDecimal("500000"));
        mockBooking.setTotalRentalFee(new BigDecimal("1000000"));
        mockBooking.setRentalMonths(1);
        mockBooking.setPaymentExpiresAt(java.time.Instant.now().plusSeconds(900));

        UUID existingPendingId = UUID.randomUUID();
        Payment existingPending = Payment.builder()
                .transactionId("BOXEXISTING999")
                .booking(mockBooking)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .status(PaymentStatus.PENDING)
                .paymentMethod("VNPAY")
                .amount(new BigDecimal("1500000"))
                .paymentTime(LocalDateTime.now().minusMinutes(2))
                .build();
        existingPending.setId(existingPendingId);

        PaymentCreateRequest request = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .amount(new BigDecimal("1500000"))
                .build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of(existingPending));
        when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");
        when(vnPayService.createPaymentUrl(eq("BOXEXISTING999"), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=BOXEXISTING999");

        VNPayPaymentResponse response = paymentService.createVNPayPayment(request, null);

        assertThat(response.getPaymentId()).isEqualTo(existingPendingId);
        assertThat(response.getTransactionId()).isEqualTo("BOXEXISTING999");
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("Task 09 Case 10: Duplicate VNPay callback (Return + IPN) is idempotent and never double-adds depositPaid")
    void testTask09_Case10_DuplicateCallbacks_IdempotentAndNoDoubleAdd() {
        mockBooking.setDepositAmount(new BigDecimal("500000"));
        mockBooking.setTotalRentalFee(new BigDecimal("1000000"));
        mockBooking.setRentalMonths(1);

        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");
        params.put("vnp_Amount", "50000000");

        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of(mockPayment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentMapper.toResponse(any(Payment.class))).thenReturn(PaymentResponse.builder().status(PaymentStatus.PAID).build());

        // First callback
        paymentService.processVNPayReturn(params);
        assertThat(mockBooking.getDepositPaid()).isEqualByComparingTo("500000");

        // Second callback (Return repeated)
        paymentService.processVNPayReturn(params);
        assertThat(mockBooking.getDepositPaid()).isEqualByComparingTo("500000");

        // Third callback (IPN repeated)
        VNPayIpnResponse ipnRes = paymentService.processVNPayIPN(params);
        assertThat(ipnRes.getRspCode()).isEqualTo("02"); // Order already confirmed
        assertThat(mockBooking.getDepositPaid()).isEqualByComparingTo("500000");
    }

    @Test
    @DisplayName("Task 09 Case 11 & 12: Exclude PENDING/FAILED/EXPIRED/REFUNDED/REFUND_PENDING and do not double-count BOOKING_PAYMENT with DEPOSIT")
    void testTask09_Case11_And_12_SummaryExcludesNonPaidAndPreventsDoubleCounting() {
        mockBooking.setDepositAmount(new BigDecimal("500000"));
        mockBooking.setTotalRentalFee(new BigDecimal("1000000"));
        mockBooking.setRentalMonths(1);

        Payment pPending = Payment.builder().paymentType(PaymentType.BOOKING_PAYMENT).status(PaymentStatus.PENDING).amount(new BigDecimal("1500000")).build();
        Payment pFailed = Payment.builder().paymentType(PaymentType.BOOKING_PAYMENT).status(PaymentStatus.FAILED).amount(new BigDecimal("1500000")).build();
        Payment pExpired = Payment.builder().paymentType(PaymentType.DEPOSIT).status(PaymentStatus.EXPIRED).amount(new BigDecimal("500000")).build();
        Payment pRefundPending = Payment.builder().paymentType(PaymentType.DEPOSIT).status(PaymentStatus.REFUND_PENDING).amount(new BigDecimal("500000")).build();
        Payment pRefunded = Payment.builder().paymentType(PaymentType.RENTAL_FEE).status(PaymentStatus.REFUNDED).amount(new BigDecimal("1000000")).build();

        PaymentServiceImpl.BookingPaymentSummary nonPaidSummary = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(pPending, pFailed, pExpired, pRefundPending, pRefunded)
        );
        assertThat(nonPaidSummary.hasAnyConfirmedPayment()).isFalse();
        assertThat(nonPaidSummary.isFullyPaid()).isFalse();
        assertThat(nonPaidSummary.totalInitialRemaining()).isEqualByComparingTo("1500000");
        assertThat(nonPaidSummary.resolvedPaymentStatus()).isEqualTo("UNPAID");

        // Anti-double-count: if booking.depositPaid is 500,000 AND BOOKING_PAYMENT of 1,500,000 is PAID,
        // deposit must be 500,000 and rent 1,000,000 (not 1,000,000 deposit)
        mockBooking.setDepositPaid(new BigDecimal("500000"));
        Payment pPaidBooking = Payment.builder().paymentType(PaymentType.BOOKING_PAYMENT).status(PaymentStatus.PAID).amount(new BigDecimal("1500000")).build();
        PaymentServiceImpl.BookingPaymentSummary paidSummary = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(pPaidBooking)
        );
        assertThat(paidSummary.effectiveDepositPaid()).isEqualByComparingTo("500000");
        assertThat(paidSummary.effectiveRentPaid()).isEqualByComparingTo("1000000");
        assertThat(paidSummary.isFullyPaid()).isTrue();
        assertThat(paidSummary.resolvedPaymentStatus()).isEqualTo("PAID");
    }

    @Test
    @DisplayName("Final Review Issue 1: booking.depositPaid > 0 must NOT be counted as held money when related transaction is REFUNDED, partially refunded, or booking is CANCELLED")
    void testFinalReview_Issue1_DepositPaidAfterRefund_NotCountedAsHeldMoney() {
        mockBooking.setStatus(BookingStatus.CONFIRMED);
        mockBooking.setPaymentStatus("PARTIALLY_PAID");
        mockBooking.setDepositAmount(new BigDecimal("1000000"));
        mockBooking.setDepositPaid(new BigDecimal("1000000"));
        mockBooking.setTotalRentalFee(new BigDecimal("2000000"));
        mockBooking.setRentalMonths(1);

        // 1a. No PAID tx, only REFUNDED deposit tx while booking.depositPaid is still 1,000,000 -> effectiveDepositPaid must be 0
        Payment refundedDepositOnly = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.REFUNDED)
                .amount(new BigDecimal("1000000"))
                .build();
        PaymentServiceImpl.BookingPaymentSummary summaryRefundedInPlace = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(refundedDepositOnly)
        );
        assertThat(summaryRefundedInPlace.effectiveDepositPaid()).isEqualByComparingTo("0");
        assertThat(summaryRefundedInPlace.depositRemaining()).isEqualByComparingTo("1000000");
        assertThat(summaryRefundedInPlace.totalInitialRemaining()).isEqualByComparingTo("3000000");
        assertThat(summaryRefundedInPlace.hasAnyConfirmedPayment()).isFalse();
        assertThat(summaryRefundedInPlace.isFullyPaid()).isFalse();
        assertThat(summaryRefundedInPlace.resolvedPaymentStatus()).isEqualTo("UNPAID");

        // 1b. Original PAID deposit tx (1,000,000) + separate partial REFUNDED tx (400,000) -> effectiveDepositPaid = 600,000, depositRemaining = 400,000
        Payment paidDeposit = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("1000000"))
                .build();
        Payment partialRefundTx = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.REFUNDED)
                .amount(new BigDecimal("400000"))
                .build();
        PaymentServiceImpl.BookingPaymentSummary summaryPartialRefund = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(paidDeposit, partialRefundTx)
        );
        assertThat(summaryPartialRefund.effectiveDepositPaid()).isEqualByComparingTo("600000");
        assertThat(summaryPartialRefund.depositRemaining()).isEqualByComparingTo("400000");
        assertThat(summaryPartialRefund.rentRemaining()).isEqualByComparingTo("2000000");
        assertThat(summaryPartialRefund.totalInitialRemaining()).isEqualByComparingTo("2400000");
        assertThat(summaryPartialRefund.isFullyPaid()).isFalse();
        assertThat(summaryPartialRefund.resolvedPaymentStatus()).isEqualTo("PARTIALLY_PAID");

        // 1c. Original PAID deposit tx (1,000,000) + full REFUNDED tx (1,000,000) -> effectiveDepositPaid = 0
        Payment fullRefundTx = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.REFUNDED)
                .amount(new BigDecimal("1000000"))
                .build();
        PaymentServiceImpl.BookingPaymentSummary summaryFullRefund = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(paidDeposit, fullRefundTx)
        );
        assertThat(summaryFullRefund.effectiveDepositPaid()).isEqualByComparingTo("0");
        assertThat(summaryFullRefund.depositRemaining()).isEqualByComparingTo("1000000");
        assertThat(summaryFullRefund.hasAnyConfirmedPayment()).isFalse();
        assertThat(summaryFullRefund.resolvedPaymentStatus()).isEqualTo("UNPAID");

        // 1d. Booking is CANCELLED while booking.depositPaid = 1,000,000 -> effectiveDepositPaid = 0
        mockBooking.setStatus(BookingStatus.CANCELLED);
        PaymentServiceImpl.BookingPaymentSummary summaryCancelled = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of()
        );
        assertThat(summaryCancelled.effectiveDepositPaid()).isEqualByComparingTo("0");
        assertThat(summaryCancelled.hasAnyConfirmedPayment()).isFalse();
        assertThat(summaryCancelled.resolvedPaymentStatus()).isEqualTo("UNPAID");
    }

    @Test
    @DisplayName("Final Review Issue 3: Partial DEPOSIT (500k/1000k) and partial RENTAL_FEE (1000k/2000k) calculates remaining 1500k and allocates subsequent payment across both")
    void testFinalReview_Issue3_PartialDepositAndPartialRent_RemainingCalculationAndAllocation() {
        mockBooking.setStatus(BookingStatus.CONFIRMED);
        mockBooking.setPaymentStatus("PARTIALLY_PAID");
        mockBooking.setDepositAmount(new BigDecimal("1000000"));
        mockBooking.setDepositPaid(new BigDecimal("500000"));
        mockBooking.setTotalRentalFee(new BigDecimal("2000000"));
        mockBooking.setRentalMonths(1);

        Payment confirmedPartialDeposit = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("500000"))
                .build();
        confirmedPartialDeposit.setId(UUID.randomUUID());

        Payment confirmedPartialRent = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.RENTAL_FEE)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("1000000"))
                .build();
        confirmedPartialRent.setId(UUID.randomUUID());

        // 1. Verify summary: depositRemaining = 500,000, rentRemaining = 1,000,000, totalInitialRemaining = 1,500,000
        PaymentServiceImpl.BookingPaymentSummary summaryBefore = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(confirmedPartialDeposit, confirmedPartialRent)
        );
        assertThat(summaryBefore.requiredDeposit()).isEqualByComparingTo("1000000");
        assertThat(summaryBefore.requiredFirstMonthRent()).isEqualByComparingTo("2000000");
        assertThat(summaryBefore.effectiveDepositPaid()).isEqualByComparingTo("500000");
        assertThat(summaryBefore.effectiveRentPaid()).isEqualByComparingTo("1000000");
        assertThat(summaryBefore.depositRemaining()).isEqualByComparingTo("500000");
        assertThat(summaryBefore.rentRemaining()).isEqualByComparingTo("1000000");
        assertThat(summaryBefore.totalInitialRemaining()).isEqualByComparingTo("1500000");
        assertThat(summaryBefore.isFullyPaid()).isFalse();
        assertThat(summaryBefore.resolvedPaymentStatus()).isEqualTo("PARTIALLY_PAID");

        // 2. Verify createVNPayPayment with BOOKING_PAYMENT selects BOOKING_PAYMENT for exact remaining 1,500,000 VND
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.findAllByBooking_Id(bookingId))
                .thenReturn(java.util.List.of(confirmedPartialDeposit, confirmedPartialRent));
        when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");

        final Payment[] createdPaymentHolder = new Payment[1];
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) {
                p.setId(UUID.randomUUID());
            }
            createdPaymentHolder[0] = p;
            return p;
        });
        when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");

        PaymentCreateRequest bookingPayReq = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .amount(new BigDecimal("3000000")) // Even if client sends full 3,000,000, backend charges only 1,500,000
                .build();
        VNPayPaymentResponse vnpRes = paymentService.createVNPayPayment(bookingPayReq, null);
        assertThat(vnpRes.getAmount()).isEqualByComparingTo("1500000");
        assertThat(createdPaymentHolder[0].getPaymentType()).isEqualTo(PaymentType.BOOKING_PAYMENT);
        assertThat(createdPaymentHolder[0].getAmount()).isEqualByComparingTo("1500000");

        // 3. Verify subsequent VNPay callback for the 1,500,000 BOOKING_PAYMENT allocates 500,000 to deposit and 1,000,000 to rent
        Payment remainingBookingPayment = createdPaymentHolder[0];
        Map<String, String> callbackParams = new HashMap<>();
        callbackParams.put("vnp_TxnRef", remainingBookingPayment.getTransactionId());
        callbackParams.put("vnp_ResponseCode", "00");
        callbackParams.put("vnp_TransactionStatus", "00");
        callbackParams.put("vnp_Amount", "150000000"); // 1,500,000 * 100

        when(vnPayService.verifySignature(callbackParams)).thenReturn(true);
        when(paymentRepository.findByTransactionId(remainingBookingPayment.getTransactionId()))
                .thenReturn(Optional.of(remainingBookingPayment));
        when(paymentRepository.findAllByBooking_Id(bookingId))
                .thenReturn(java.util.List.of(confirmedPartialDeposit, confirmedPartialRent, remainingBookingPayment));
        when(paymentMapper.toResponse(any(Payment.class)))
                .thenReturn(PaymentResponse.builder().status(PaymentStatus.PAID).amount(new BigDecimal("1500000")).build());

        paymentService.processVNPayReturn(callbackParams);

        // Verify both deposit (1,000,000) and rent (2,000,000) are now satisfied and booking is PAID
        assertThat(remainingBookingPayment.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(mockBooking.getDepositPaid()).isEqualByComparingTo("1000000");
        assertThat(mockBooking.getPaymentStatus()).isEqualTo("PAID");

        PaymentServiceImpl.BookingPaymentSummary summaryAfter = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(confirmedPartialDeposit, confirmedPartialRent, remainingBookingPayment)
        );
        assertThat(summaryAfter.effectiveDepositPaid()).isEqualByComparingTo("1000000");
        assertThat(summaryAfter.effectiveRentPaid()).isEqualByComparingTo("2000000");
        assertThat(summaryAfter.depositRemaining()).isEqualByComparingTo("0");
        assertThat(summaryAfter.rentRemaining()).isEqualByComparingTo("0");
        assertThat(summaryAfter.totalInitialRemaining()).isEqualByComparingTo("0");
        assertThat(summaryAfter.isFullyPaid()).isTrue();
        assertThat(summaryAfter.resolvedPaymentStatus()).isEqualTo("PAID");
    }

    @Test
    @DisplayName("Refund Spec Case 1, 2, 3, 4, 5: REFUND_PENDING is not deducted, REFUNDED is deducted once, confirmation level reflects staff transfer vs bank reconciliation, REJECTED refund does not deduct or block")
    void testRefundPending_Vs_Refunded_And_AntiDoubleDeduction_And_ConfirmationLevels() {
        mockBooking.setStatus(BookingStatus.CONFIRMED);
        mockBooking.setPaymentStatus("PARTIALLY_PAID");
        mockBooking.setDepositAmount(new BigDecimal("1000000"));
        mockBooking.setDepositPaid(new BigDecimal("1000000"));
        mockBooking.setTotalRentalFee(new BigDecimal("2000000"));
        mockBooking.setRentalMonths(1);

        Payment paid1M = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.PAID)
                .paymentMethod("VNPAY")
                .transactionId("BOX-IN-1000K")
                .amount(new BigDecimal("1000000"))
                .build();
        Payment refundPending400k = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.REFUND_PENDING)
                .amount(new BigDecimal("400000"))
                .build();
        Payment refunded400k = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.REFUNDED)
                .paymentMethod("BANK_TRANSFER")
                .transactionId("UNC-400K-01")
                .referenceCode("REF-2026-001")
                .amount(new BigDecimal("400000"))
                .build();
        Payment refunded1M = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.REFUNDED)
                .paymentMethod("BANK_TRANSFER")
                .transactionId("UNC-1000K-01")
                .referenceCode("REF-2026-002")
                .amount(new BigDecimal("1000000"))
                .build();

        // Case 1: PAID 1,000,000đ + REFUND_PENDING 400,000đ -> held deposit is still 1,000,000đ
        PaymentServiceImpl.BookingPaymentSummary case1 = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(paid1M, refundPending400k)
        );
        assertThat(case1.effectiveDepositPaid()).isEqualByComparingTo("1000000");
        assertThat(case1.hasPendingRefund()).isTrue();
        assertThat(case1.refundConfirmationLevel()).isEqualTo("REFUND_PENDING_RECONCILIATION");

        // Case 2: PAID 1,000,000đ + REFUNDED 400,000đ -> held deposit is 600,000đ (staff recorded transfer before bank reconciliation)
        when(refundRequestRepository.existsByBooking_IdAndStatusIn(eq(bookingId), any())).thenReturn(false);
        PaymentServiceImpl.BookingPaymentSummary case2 = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(paid1M, refunded400k)
        );
        assertThat(case2.effectiveDepositPaid()).isEqualByComparingTo("600000");
        assertThat(case2.refundConfirmationLevel()).isEqualTo("STAFF_RECORDED_TRANSFER_UNVERIFIED_BANK");

        // When RefundRequest reaches RECONCILED / COMPLETED -> confirmation level is BANK_RECONCILED
        when(refundRequestRepository.existsByBooking_IdAndStatusIn(eq(bookingId), any())).thenReturn(true);
        PaymentServiceImpl.BookingPaymentSummary case2Reconciled = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(paid1M, refunded400k)
        );
        assertThat(case2Reconciled.effectiveDepositPaid()).isEqualByComparingTo("600000");
        assertThat(case2Reconciled.refundConfirmationLevel()).isEqualTo("BANK_RECONCILED");
        when(refundRequestRepository.existsByBooking_IdAndStatusIn(eq(bookingId), any())).thenReturn(false);

        // Case 3: PAID 1,000,000đ + REFUNDED 1,000,000đ -> held deposit is 0đ
        PaymentServiceImpl.BookingPaymentSummary case3 = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(paid1M, refunded1M)
        );
        assertThat(case3.effectiveDepositPaid()).isEqualByComparingTo("0");

        // Case 4a: Same refund has both REFUND_PENDING (400k) and REFUNDED (400k) -> deducted only once (600,000đ)
        PaymentServiceImpl.BookingPaymentSummary case4a = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(paid1M, refundPending400k, refunded400k)
        );
        assertThat(case4a.effectiveDepositPaid()).isEqualByComparingTo("600000");

        // Case 4b: System both mutated original incoming Payment(VNPAY, 1,000,000đ) to REFUNDED AND created new dedicated Payment(BANK_TRANSFER, 400,000đ, REFUNDED) -> never double-deducted (600,000đ)
        Payment mutatedOriginalIncoming = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.REFUNDED)
                .paymentMethod("VNPAY")
                .transactionId("BOX-IN-1000K")
                .amount(new BigDecimal("1000000"))
                .build();
        PaymentServiceImpl.BookingPaymentSummary case4b = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(mutatedOriginalIncoming, refunded400k)
        );
        assertThat(case4b.effectiveDepositPaid()).isEqualByComparingTo("600000");

        // Case 5: RefundRequest is REJECTED (existsByBooking_IdAndStatusIn active statuses returns false) -> no deduction (1,000,000đ) and hasPendingRefund is false
        when(refundRequestRepository.existsByBooking_IdAndStatusIn(eq(bookingId), any())).thenReturn(false);
        PaymentServiceImpl.BookingPaymentSummary case5 = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(paid1M)
        );
        assertThat(case5.effectiveDepositPaid()).isEqualByComparingTo("1000000");
        assertThat(case5.hasPendingRefund()).isFalse();
        assertThat(case5.refundConfirmationLevel()).isEqualTo("NONE");
    }

    @Test
    @DisplayName("Refund Spec Case 7, 8, 9: Block createVNPayPayment when awaiting refund, block stale depositPaid on REFUND_PENDING/PENDING_PAYMENT, and preserve legacy depositPaid on CONFIRMED when FAILED/EXPIRED occurs")
    void testRefundSpec_Cases7_8_9_BlockPaymentOnPendingRefund_And_LegacyDepositFallback() {
        mockBooking.setStatus(BookingStatus.CONFIRMED);
        mockBooking.setPaymentStatus("PARTIALLY_PAID");
        mockBooking.setDepositAmount(new BigDecimal("500000"));
        mockBooking.setDepositPaid(new BigDecimal("500000"));
        mockBooking.setTotalRentalFee(new BigDecimal("1000000"));
        mockBooking.setRentalMonths(1);

        // Case 7: Booking has REFUND_PENDING or active RefundRequest -> createVNPayPayment is blocked with INVALID_REQUEST
        Payment paidDeposit = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("500000"))
                .build();
        Payment pendingRefundTx = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.REFUND_PENDING)
                .amount(new BigDecimal("500000"))
                .build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of(paidDeposit, pendingRefundTx));

        PaymentCreateRequest payReq = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.RENTAL_FEE)
                .amount(new BigDecimal("1000000"))
                .build();
        AppException exBlocked = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(payReq, null));
        assertThat(exBlocked.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);

        // Case 8: No PAID transaction while booking.depositPaid has stale balance (500,000đ) and REFUND_PENDING exists -> effectiveDepositPaid = 0đ
        PaymentServiceImpl.BookingPaymentSummary case8 = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(pendingRefundTx)
        );
        assertThat(case8.effectiveDepositPaid()).isEqualByComparingTo("0");

        // Case 9: Legacy CONFIRMED booking (depositPaid = 500,000đ, status = CONFIRMED, paymentStatus = PARTIALLY_PAID)
        // with no PAID deposit tx row, but a subsequent FAILED/EXPIRED VNPay attempt -> fallback to booking.depositPaid (500,000đ) is preserved!
        Payment failedRentAttempt = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .status(PaymentStatus.FAILED)
                .amount(new BigDecimal("1000000"))
                .build();
        Payment expiredDepositAttempt = Payment.builder()
                .booking(mockBooking)
                .paymentType(PaymentType.DEPOSIT)
                .status(PaymentStatus.EXPIRED)
                .amount(new BigDecimal("500000"))
                .build();
        PaymentServiceImpl.BookingPaymentSummary case9 = paymentService.calculateBookingPaymentSummary(
                mockBooking,
                java.util.List.of(failedRentAttempt, expiredDepositAttempt)
        );
        assertThat(case9.effectiveDepositPaid()).isEqualByComparingTo("500000");
        assertThat(case9.depositRemaining()).isEqualByComparingTo("0");
        assertThat(case9.rentRemaining()).isEqualByComparingTo("1000000");
        assertThat(case9.resolvedPaymentStatus()).isEqualTo("PARTIALLY_PAID");
    }
}
