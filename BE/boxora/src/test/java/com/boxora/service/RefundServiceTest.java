package com.boxora.service;

import com.boxora.dto.request.*;
import com.boxora.dto.response.RefundRequestResponse;
import com.boxora.entity.Booking;
import com.boxora.entity.Facility;
import com.boxora.entity.RefundRequest;
import com.boxora.entity.User;
import com.boxora.enums.RefundStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.RefundServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefundServiceTest {

    @Mock
    private RefundRequestRepository refundRequestRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @Mock
    private com.boxora.repository.FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private com.boxora.service.FileStorageService fileStorageService;

    @InjectMocks
    private RefundServiceImpl refundService;

    private User mockCustomer;
    private User mockStaff;
    private Booking mockBooking;
    private Facility mockFacility;
    private UUID bookingId;
    private UUID customerId;
    private UUID staffId;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        customerId = UUID.randomUUID();
        staffId = UUID.randomUUID();

        mockFacility = Facility.builder().name("Boxora Quận 7").build();
        mockFacility.setId(UUID.randomUUID());

        mockCustomer = User.builder()
                .fullName("Lê Văn C")
                .email("c.le@example.com")
                .phone("0912345678")
                .isActive(true)
                .build();
        mockCustomer.setId(customerId);

        mockStaff = User.builder()
                .username("manager_user")
                .fullName("Quản Lý Chi Nhánh")
                .isActive(true)
                .build();
        mockStaff.setId(staffId);

        mockBooking = Booking.builder()
                .bookingCode("BK-REF-100")
                .customer(mockCustomer)
                .storageUnit(com.boxora.entity.StorageUnit.builder().unitCode("Q7-A01").facility(mockFacility).build())
                .depositPaid(new BigDecimal("1000000"))
                .build();
        mockBooking.setId(bookingId);
    }

    @Test
    @DisplayName("createRefundRequest should create request with status PENDING_REVIEW")
    void testCreateRefundRequestSuccess() {
        RefundCreateRequest request = RefundCreateRequest.builder()
                .bookingId(bookingId)
                .requestedAmount(new BigDecimal("1000000"))
                .deductionAmount(new BigDecimal("100000"))
                .bankName("Vietcombank")
                .bankAccountNumber("0123456789")
                .bankAccountName("LE VAN C")
                .reason("Hoàn tiền đặt cọc sau khi hoàn trả kho")
                .build();

        when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(mockBooking));
        when(requestContext.currentUserId()).thenReturn(customerId);
        when(userRepository.findById(customerId)).thenReturn(Optional.of(mockCustomer));
        when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RefundRequestResponse response = refundService.createRefundRequest(request);

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(RefundStatus.PENDING_REVIEW);
        assertThat(response.getRequestedAmount()).isEqualByComparingTo("1000000");
        assertThat(response.getDeductionAmount()).isEqualByComparingTo("0");
        assertThat(response.getFinalRefundAmount()).isEqualByComparingTo("1000000");
        assertThat(response.getRequestCode()).startsWith("REF-");

        verify(refundRequestRepository).save(any(RefundRequest.class));
    }

    @Test
    @DisplayName("reviewRefundRequest with APPROVE should transition to APPROVED")
    void testReviewRefundApprove() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-12345")
                .customer(mockCustomer)
                .facility(mockFacility)
                .requestedAmount(new BigDecimal("500000"))
                .finalRefundAmount(new BigDecimal("500000"))
                .bankName("MB Bank")
                .bankAccountNumber("99999999")
                .bankAccountName("LE VAN C")
                .status(RefundStatus.PENDING_REVIEW)
                .build();
        refund.setId(refundId);

        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));
        when(requestContext.currentUserId()).thenReturn(staffId);
        when(userRepository.findById(staffId)).thenReturn(Optional.of(mockStaff));
        when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RefundReviewRequest reviewRequest = RefundReviewRequest.builder()
                .action("APPROVE")
                .reviewNote("Hồ sơ trả kho hợp lệ, không hư hại")
                .build();

        RefundRequestResponse response = refundService.reviewRefundRequest(refundId, reviewRequest);

        assertThat(response.getStatus()).isEqualTo(RefundStatus.APPROVED);
        assertThat(response.getReviewNote()).isEqualTo("Hồ sơ trả kho hợp lệ, không hư hại");
        verify(emailService).sendRefundStatusEmail(anyString(), anyString(), anyString(), eq("APPROVED"), any(), anyString(), anyString(), any(), any());
    }

    @Test
    @DisplayName("startTransfer should transition APPROVED to PROCESSING_TRANSFER")
    void testStartTransferSuccess() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-12345")
                .customer(mockCustomer)
                .facility(mockFacility)
                .bankName("MB Bank")
                .bankAccountNumber("99999999")
                .bankAccountName("LE VAN C")
                .status(RefundStatus.APPROVED)
                .build();
        refund.setId(refundId);

        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));
        when(requestContext.currentUserId()).thenReturn(staffId);
        when(userRepository.findById(staffId)).thenReturn(Optional.of(mockStaff));
        when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RefundTransferRequest transferRequest = RefundTransferRequest.builder()
                .transferReference("UNC-20261017-001")
                .transferNotes("Đã gửi UNC sang ngân hàng")
                .build();

        RefundRequestResponse response = refundService.startTransfer(refundId, transferRequest);

        assertThat(response.getStatus()).isEqualTo(RefundStatus.PROCESSING_TRANSFER);
        assertThat(response.getTransferReference()).isEqualTo("UNC-20261017-001");
    }

    @Test
    @DisplayName("processRefund should transition APPROVED/PROCESSING_TRANSFER to AWAITING_CUSTOMER_CONFIRMATION")
    void testProcessRefundSuccess() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-12345")
                .customer(mockCustomer)
                .facility(mockFacility)
                .bankName("MB Bank")
                .bankAccountNumber("99999999")
                .bankAccountName("LE VAN C")
                .booking(mockBooking)
                .requestedAmount(new BigDecimal("500000"))
                .finalRefundAmount(new BigDecimal("500000"))
                .bankName("MB Bank")
                .bankAccountNumber("99999999")
                .bankAccountName("LE VAN C")
                .status(RefundStatus.APPROVED)
                .build();
        refund.setId(refundId);

        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));
        when(requestContext.currentUserId()).thenReturn(staffId);
        when(userRepository.findById(staffId)).thenReturn(Optional.of(mockStaff));
        when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RefundProcessRequest processRequest = RefundProcessRequest.builder()
                .transactionReference("FT261008000123")
                .processNotes("Đã chuyển khoản qua Internet Banking MB")
                .build();

        RefundRequestResponse response = refundService.processRefund(refundId, processRequest);

        assertThat(response.getStatus()).isEqualTo(RefundStatus.AWAITING_CUSTOMER_CONFIRMATION);
        assertThat(response.getTransactionReference()).isEqualTo("FT261008000123");
        verify(emailService).sendRefundStatusEmail(anyString(), anyString(), anyString(), eq("AWAITING_CUSTOMER_CONFIRMATION"), any(), anyString(), anyString(), eq("FT261008000123"), anyString());
    }

    @Test
    @DisplayName("confirmCustomerReceived should transition to RECONCILED")
    void testConfirmCustomerReceived() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-12345")
                .customer(mockCustomer)
                .facility(mockFacility)
                .status(RefundStatus.AWAITING_CUSTOMER_CONFIRMATION)
                .build();
        refund.setId(refundId);

        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));
        when(requestContext.currentUserId()).thenReturn(customerId);
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RefundCustomerConfirmRequest confirmRequest = RefundCustomerConfirmRequest.builder()
                .confirmationNotes("Đã nhận đủ tiền")
                .build();

        RefundRequestResponse response = refundService.confirmCustomerReceived(refundId, confirmRequest);

        assertThat(response.getStatus()).isEqualTo(RefundStatus.RECONCILED);
        assertThat(response.getCustomerConfirmationNotes()).isEqualTo("Đã nhận đủ tiền");
    }

    @Test
    @DisplayName("reconcileRefund should transition RECONCILED to COMPLETED")
    void testReconcileRefundSuccess() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-12345")
                .customer(mockCustomer)
                .facility(mockFacility)
                .status(RefundStatus.RECONCILED)
                .build();
        refund.setId(refundId);

        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));
        when(requestContext.currentUserId()).thenReturn(staffId);
        when(userRepository.findById(staffId)).thenReturn(Optional.of(mockStaff));
        when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        RefundReconcileRequest reconcileRequest = RefundReconcileRequest.builder()
                .reconciliationNotes("Khớp sổ phụ ngân hàng ngày 17/10")
                .build();

        RefundRequestResponse response = refundService.reconcileRefund(refundId, reconcileRequest);

        assertThat(response.getStatus()).isEqualTo(RefundStatus.COMPLETED);
        assertThat(response.getReconciliationNotes()).isEqualTo("Khớp sổ phụ ngân hàng ngày 17/10");
    }

    @Test
    @DisplayName("processRefund should throw REFUND_NOT_APPROVED when request is still PENDING_REVIEW")
    void testProcessRefundThrowsIfNotApproved() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .status(RefundStatus.PENDING_REVIEW)
                .build();
        refund.setId(refundId);

        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));

        RefundProcessRequest processRequest = RefundProcessRequest.builder()
                .transactionReference("FT123456")
                .build();

        AppException ex = assertThrows(AppException.class, () -> refundService.processRefund(refundId, processRequest));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.REFUND_NOT_APPROVED);
    }

    @Test
    @DisplayName("processRefund should throw REFUND_ALREADY_PROCESSED when request is already COMPLETED or PROCESSED")
    void testProcessRefundThrowsIfAlreadyCompleted() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .status(RefundStatus.COMPLETED)
                .build();
        refund.setId(refundId);

        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));

        RefundProcessRequest processRequest = RefundProcessRequest.builder()
                .transactionReference("FT123456")
                .build();

        AppException ex = assertThrows(AppException.class, () -> refundService.processRefund(refundId, processRequest));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.REFUND_ALREADY_PROCESSED);
    }

    @Test
    @DisplayName("confirmCustomerReceived should throw FORBIDDEN if customer is not the request owner")
    void testConfirmCustomerReceivedThrowsIfUnauthorizedCustomer() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .customer(mockCustomer)
                .status(RefundStatus.AWAITING_CUSTOMER_CONFIRMATION)
                .build();
        refund.setId(refundId);

        UUID attackerId = UUID.randomUUID();
        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));
        when(requestContext.currentUserId()).thenReturn(attackerId);
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");

        RefundCustomerConfirmRequest confirmRequest = RefundCustomerConfirmRequest.builder()
                .confirmationNotes("Attacker trying to confirm")
                .build();

        AppException ex = assertThrows(AppException.class, () -> refundService.confirmCustomerReceived(refundId, confirmRequest));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("startTransfer is blocked while the customer has not provided a bank account")
    void testStartTransferBlockedWithoutBankAccount() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-NOBANK")
                .customer(mockCustomer)
                .facility(mockFacility)
                .status(RefundStatus.APPROVED)
                .bankAccountNumber("N/A")
                .build();
        refund.setId(refundId);
        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));

        AppException ex = assertThrows(AppException.class, () -> refundService.startTransfer(refundId,
                RefundTransferRequest.builder().transferReference("UNC-1").build()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.REFUND_BANK_INFO_REQUIRED);
        verify(refundRequestRepository, never()).save(any(RefundRequest.class));
    }

    @Test
    @DisplayName("updateBankAccount: the owner provides the account; customers see it masked, the request is flagged complete")
    void testUpdateBankAccountByCustomer() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-ADD-BANK")
                .customer(mockCustomer)
                .facility(mockFacility)
                .status(RefundStatus.PENDING_REVIEW)
                .finalRefundAmount(new BigDecimal("500000"))
                .build();
        refund.setId(refundId);
        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));
        when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(customerId);

        RefundRequestResponse response = refundService.updateBankAccount(refundId, com.boxora.dto.request.RefundBankAccountRequest.builder()
                .bankName("Vietcombank").bankAccountNumber("0123 4567 89").bankAccountName("LE VAN C").build());

        assertThat(refund.getBankAccountNumber()).isEqualTo("0123456789");
        assertThat(response.isBankInfoMissing()).isFalse();
        assertThat(response.getBankAccountNumber()).isEqualTo("****6789");
    }

    @Test
    @DisplayName("updateBankAccount: another customer cannot change the account of a refund")
    void testUpdateBankAccountOtherCustomerForbidden() {
        UUID refundId = UUID.randomUUID();
        RefundRequest refund = RefundRequest.builder()
                .requestCode("REF-OTHER")
                .customer(mockCustomer)
                .facility(mockFacility)
                .status(RefundStatus.PENDING_REVIEW)
                .build();
        refund.setId(refundId);
        when(refundRequestRepository.findById(refundId)).thenReturn(Optional.of(refund));
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        when(requestContext.currentUserId()).thenReturn(UUID.randomUUID());

        AppException ex = assertThrows(AppException.class, () -> refundService.updateBankAccount(refundId,
                com.boxora.dto.request.RefundBankAccountRequest.builder().bankName("ACB").bankAccountNumber("12345678").bankAccountName("X Y").build()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }
}
