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
import com.boxora.security.RequestContext;
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
    private com.boxora.security.FacilityAccessGuard facilityAccessGuard;

    @Mock
    private org.springframework.beans.factory.ObjectProvider<ContractRenewalService> contractRenewalServiceProvider;

    @Mock
    private com.boxora.service.StorageUnitLockService storageUnitLockService;

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
}
