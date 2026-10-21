package com.boxora.service;

import com.boxora.dto.request.RefundCustomerConfirmRequest;
import com.boxora.dto.request.RefundProcessRequest;
import com.boxora.dto.request.RefundReconcileRequest;
import com.boxora.dto.request.RefundReviewRequest;
import com.boxora.dto.request.RefundTransferRequest;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.function.Executable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Round-2 QA (t4#0): every back-office refund action is facility-scoped, customers can only confirm their own refund,
 * and a staff member of another facility can no longer confirm receipt and push a refund to RECONCILED.
 */
@ExtendWith(MockitoExtension.class)
class RefundScopeTest {

    @Mock private RefundRequestRepository refundRequestRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationLogRepository notificationLogRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private EmailService emailService;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private RequestContext requestContext;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private FileStorageService fileStorageService;

    @InjectMocks
    private RefundServiceImpl refundService;

    private Facility otherFacility;
    private User customer;
    private RefundRequest refund;

    @BeforeEach
    void setUp() {
        otherFacility = Facility.builder().name("QA Kho Kiểm Thử 16211").build();
        otherFacility.setId(UUID.randomUUID());
        customer = User.builder().fullName("Khách QA").email("qa@example.test").build();
        customer.setId(UUID.randomUUID());
        refund = RefundRequest.builder()
                .requestCode("REF-1792547612802-HEMD")
                .customer(customer)
                .facility(otherFacility)
                .requestedAmount(new BigDecimal("715000"))
                .deductionAmount(new BigDecimal("250000"))
                .finalRefundAmount(new BigDecimal("465000"))
                .bankName("VCB")
                .bankAccountNumber("0123456789")
                .bankAccountName("KHACH QA")
                .status(RefundStatus.AWAITING_CUSTOMER_CONFIRMATION)
                .build();
        refund.setId(UUID.randomUUID());
        when(refundRequestRepository.findById(refund.getId())).thenReturn(Optional.of(refund));
    }

    private void staffOfAnotherFacility() {
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED)).when(facilityAccessGuard).checkFacilityAccess(otherFacility.getId());
    }

    @Test
    void staffOfAnotherFacilityCannotConfirmReceipt() {
        staffOfAnotherFacility();

        AppException error = assertThrows(AppException.class, () -> refundService.confirmCustomerReceived(refund.getId(),
                RefundCustomerConfirmRequest.builder().confirmationNotes("staff of another facility").build()));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
        assertThat(refund.getStatus()).isEqualTo(RefundStatus.AWAITING_CUSTOMER_CONFIRMATION);
        assertThat(refund.getCustomerConfirmationNotes()).isNull();
        verify(refundRequestRepository, never()).save(any());
    }

    @Test
    void staffOfAnotherFacilityCannotReviewTransferProcessOrReconcile() {
        staffOfAnotherFacility();
        RefundStatus[] statuses = {RefundStatus.PENDING_REVIEW, RefundStatus.APPROVED, RefundStatus.PROCESSING_TRANSFER, RefundStatus.RECONCILED};
        Executable[] actions = {
                () -> refundService.reviewRefundRequest(refund.getId(), RefundReviewRequest.builder().action("APPROVE").build()),
                () -> refundService.startTransfer(refund.getId(), RefundTransferRequest.builder().transferReference("UNC-1").build()),
                () -> refundService.processRefund(refund.getId(), RefundProcessRequest.builder().transactionReference("FT1").build()),
                () -> refundService.reconcileRefund(refund.getId(), RefundReconcileRequest.builder().build()),
        };
        for (int i = 0; i < actions.length; i++) {
            refund.setStatus(statuses[i]);
            Executable action = actions[i];
            AppException error = assertThrows(AppException.class, action);
            assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
        }
        verify(refundRequestRepository, never()).save(any());
    }

    @Test
    void customerCannotRunBackOfficeActions() {
        when(requestContext.currentUserRole()).thenReturn("CUSTOMER");
        refund.setStatus(RefundStatus.RECONCILED);

        AppException error = assertThrows(AppException.class,
                () -> refundService.reconcileRefund(refund.getId(), RefundReconcileRequest.builder().build()));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
        verify(refundRequestRepository, never()).save(any());
    }

    @Test
    void scopedStaffCannotTouchARefundWithoutFacility() {
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        refund.setFacility(null);

        AppException error = assertThrows(AppException.class, () -> refundService.getById(refund.getId()));

        assertThat(error.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
    }

    @Test
    void staffOfTheFacilityCanRecordReceiptOnBehalfOfTheCustomer() {
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(true);
        when(refundRequestRepository.save(any(RefundRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        refundService.confirmCustomerReceived(refund.getId(), RefundCustomerConfirmRequest.builder().build());

        verify(facilityAccessGuard).checkFacilityAccess(otherFacility.getId());
        assertThat(refund.getStatus()).isEqualTo(RefundStatus.RECONCILED);
        assertThat(refund.getCustomerConfirmationNotes()).isEqualTo("Nhân viên ghi nhận thay khách hàng");
    }
}
