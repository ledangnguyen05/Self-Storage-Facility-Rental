package com.boxora.service;

import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Payment;
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
                .depositPaid(BigDecimal.ZERO)
                .depositAmount(new BigDecimal("500000"))
                .rentalMonths(1)
                .totalRentalFee(new BigDecimal("1000000"))
                .paymentExpiresAt(java.time.Instant.now().plusSeconds(3600))
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
    }

    @Test
    @DisplayName("createVNPayPayment charges the server-computed first month + deposit and returns the checkout URL")
    void testCreateVNPayPaymentSuccess() {
        PaymentCreateRequest request = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .paymentType(PaymentType.BOOKING_PAYMENT)
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
        assertThat(response.getAmount()).isEqualByComparingTo("1500000");
        assertThat(response.getBookingId()).isEqualTo(bookingId);

        verify(paymentRepository).save(any(Payment.class));
        verify(activityLogService).record(nullable(UUID.class), eq(ActivityAction.PAYMENT_INITIATED), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("createVNPayPayment should throw BOOKING_NOT_FOUND when booking does not exist")
    void testCreateVNPayPaymentBookingNotFound() {
        PaymentCreateRequest request = PaymentCreateRequest.builder()
                .bookingId(UUID.randomUUID())
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .build();

        when(bookingRepository.findById(any())).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(request, null));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.BOOKING_NOT_FOUND);
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
    @DisplayName("processVNPayReturn should mark Payment as FAILED when responseCode is not 00")
    void testProcessVNPayReturnFailure() {
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOX123456789");
        params.put("vnp_ResponseCode", "24"); // Cancelled by customer
        params.put("vnp_TransactionStatus", "02");

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
    @DisplayName("createVNPayPayment rejects client-chosen payment types (DEPOSIT / EXTRA_CHARGE ...) before touching the booking")
    void createVNPayPayment_RejectsNonBookingTypes() {
        for (PaymentType type : new PaymentType[]{PaymentType.DEPOSIT, PaymentType.EXTRA_CHARGE, PaymentType.RENTAL_FEE, PaymentType.RENEWAL_FEE}) {
            PaymentCreateRequest request = PaymentCreateRequest.builder()
                    .bookingId(bookingId)
                    .paymentType(type)
                    .amount(new BigDecimal("1000"))
                    .build();
            AppException ex = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(request, null));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_TYPE_NOT_ALLOWED);
        }
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("createVNPayPayment: a customer cannot pay (and confirm) another customer's booking")
    void createVNPayPayment_OtherCustomer_Forbidden() {
        com.boxora.entity.User owner = com.boxora.entity.User.builder().email("owner@boxora.vn").build();
        owner.setId(UUID.randomUUID());
        mockBooking.setCustomer(owner);
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());

        AppException ex = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(
                PaymentCreateRequest.builder().bookingId(bookingId).build(), null));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("createVNPayPayment: a client amount far from the server amount is rejected (no 1.000 VND confirmations)")
    void createVNPayPayment_TamperedAmount_Rejected() {
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));

        AppException ex = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(
                PaymentCreateRequest.builder().bookingId(bookingId).amount(new BigDecimal("1000")).build(), null));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    @Test
    @DisplayName("createVNPayPayment: a free in-person hold (CONFIRMED, unpaid) can be paid online; the return keeps it CONFIRMED and PAID")
    void createVNPayPayment_ConfirmedHold_PaidOnline() {
        mockBooking.setStatus(BookingStatus.CONFIRMED);
        mockBooking.setPaymentStatus("UNPAID");
        mockBooking.setPaymentExpiresAt(null);
        mockBooking.setHoldExpiresAt(java.time.Instant.now().plusSeconds(7200));
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(requestContext.currentIpAddress()).thenReturn("127.0.0.1");
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=X");

        VNPayPaymentResponse response = paymentService.createVNPayPayment(PaymentCreateRequest.builder().bookingId(bookingId).build(), null);
        assertThat(response.getAmount()).isEqualByComparingTo("1500000");

        Payment created = Payment.builder()
                .transactionId("BOXHOLD1")
                .booking(mockBooking)
                .amount(new BigDecimal("1500000"))
                .paymentType(PaymentType.BOOKING_PAYMENT)
                .status(PaymentStatus.PENDING)
                .paymentTime(LocalDateTime.now())
                .build();
        Map<String, String> params = new HashMap<>();
        params.put("vnp_TxnRef", "BOXHOLD1");
        params.put("vnp_Amount", "150000000");
        params.put("vnp_ResponseCode", "00");
        params.put("vnp_TransactionStatus", "00");
        when(vnPayService.verifySignature(params)).thenReturn(true);
        when(paymentRepository.findByTransactionId("BOXHOLD1")).thenReturn(Optional.of(created));

        paymentService.processVNPayReturn(params);

        assertThat(created.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(mockBooking.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(mockBooking.getPaymentStatus()).isEqualTo("PAID");
        assertThat(mockBooking.getDepositPaid()).isEqualByComparingTo("500000");
    }

    @Test
    @DisplayName("createVNPayPayment: nothing left to pay when the initial amount is already covered")
    void createVNPayPayment_AlreadyPaid_Rejected() {
        Payment paid = Payment.builder().amount(new BigDecimal("1500000")).paymentType(PaymentType.BOOKING_PAYMENT)
                .status(PaymentStatus.PAID).build();
        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(java.util.List.of(paid));

        AppException ex = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(
                PaymentCreateRequest.builder().bookingId(bookingId).build(), null));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_ALREADY_PROCESSED);
    }

    @Test
    @DisplayName("getByTransactionId: a customer cannot read another customer's payment")
    void getByTransactionId_OtherCustomer_Forbidden() {
        com.boxora.entity.User owner = com.boxora.entity.User.builder().email("owner@boxora.vn").build();
        owner.setId(UUID.randomUUID());
        mockBooking.setCustomer(owner);
        when(paymentRepository.findByTransactionId("BOX123456789")).thenReturn(Optional.of(mockPayment));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());

        AppException ex = assertThrows(AppException.class, () -> paymentService.getByTransactionId("BOX123456789"));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }
}
