package com.boxora.service;

import com.boxora.client.DocuSealClient;
import com.boxora.config.DocuSealConfig;
import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.dto.response.DocuSealSubmitterResponse;
import com.boxora.entity.ContractRenewal;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.Payment;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.ContractRenewalStatus;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.RentalContractStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.ContractRenewalMapper;
import com.boxora.repository.ContractRenewalRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.PaymentRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.UserRepository;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.StaffAssignmentRepository;
import com.boxora.entity.StaffAssignment;
import com.boxora.enums.StaffAssignmentStatus;
import com.boxora.dto.request.ContractRenewalAssignStaffRequest;
import com.boxora.dto.request.ContractRenewalReceptionRequest;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.ContractRenewalServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContractRenewalServiceTest {

    @Mock
    private DocuSealClient docuSealClient;

    @Mock
    private DocuSealConfig docuSealConfig;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private ContractRenewalRepository contractRenewalRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private ContractRenewalMapper contractRenewalMapper;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @Mock
    private org.springframework.beans.factory.ObjectProvider<PaymentService> paymentServiceProvider;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @Mock
    private StaffAssignmentRepository staffAssignmentRepository;

    @InjectMocks
    private ContractRenewalServiceImpl contractRenewalService;

    private RentalContract mockContract;
    private ContractRenewal mockRenewal;
    private Facility mockFacility;
    private User mockUser;
    private StorageUnit mockUnit;
    private UUID contractId;
    private UUID renewalId;

    @BeforeEach
    void setUp() {
        contractId = UUID.randomUUID();
        renewalId = UUID.randomUUID();

        mockUser = User.builder()
                .fullName("Tran Van B")
                .email("tranvanb@example.com")
                .build();
        mockUser.setId(UUID.randomUUID());

        mockFacility = Facility.builder()
                .name("Boxora Binh Thanh")
                .build();
        mockFacility.setId(UUID.randomUUID());

        mockUnit = StorageUnit.builder()
                .unitCode("UNIT-202")
                .facility(mockFacility)
                .build();
        mockUnit.setId(UUID.randomUUID());

        // Hợp đồng kết thúc ngày mai (nằm trong window 3 ngày)
        mockContract = RentalContract.builder()
                .contractCode("CTR-2026-002")
                .customer(mockUser)
                .unit(mockUnit)
                .facility(mockFacility)
                .startDate(LocalDate.now().minusMonths(1))
                .endDate(LocalDate.now().plusDays(2))
                .monthlyFee(new BigDecimal("2000000"))
                .status(RentalContractStatus.ACTIVE)
                .build();
        mockContract.setId(contractId);

        mockRenewal = ContractRenewal.builder()
                .contract(mockContract)
                .oldEndDate(mockContract.getEndDate())
                .newEndDate(mockContract.getEndDate().plusMonths(3))
                .cycleMonths(3)
                .renewalFee(new BigDecimal("6000000"))
                .status(ContractRenewalStatus.PENDING_SIGNATURE)
                .build();
        mockRenewal.setId(renewalId);
    }

    @Test
    @DisplayName("requestRenewal should succeed with PENDING_REVIEW status when contract is active and valid")
    void testRequestRenewalSuccess() {
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> {
            ContractRenewal r = inv.getArgument(0);
            r.setId(renewalId);
            return r;
        });

        ContractRenewalResponse mockResponse = ContractRenewalResponse.builder()
                .id(renewalId)
                .contractId(contractId)
                .renewalFee(new BigDecimal("6000000"))
                .cycleMonths(3)
                .status(ContractRenewalStatus.PENDING_REVIEW)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockResponse);

        ContractRenewalResponse response = contractRenewalService.requestRenewal(contractId, 3);

        assertThat(response).isNotNull();
        assertThat(response.getStatus()).isEqualTo(ContractRenewalStatus.PENDING_REVIEW);
        verify(activityLogService).record(any(UUID.class), eq(ActivityAction.RENEWAL_REQUEST), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("requestRenewal should succeed even when requested months before expiration (project policy)")
    void testRequestRenewalAllowedBeforeExpiration() {
        // Hợp đồng còn 60 ngày nữa mới hết hạn, customer vẫn được phép gia hạn bất cứ lúc nào
        mockContract.setEndDate(LocalDate.now().plusDays(60));

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(contractRenewalRepository.existsByContract_IdAndStatusIn(eq(contractId), anyList())).thenReturn(false);
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> {
            ContractRenewal r = inv.getArgument(0);
            r.setId(UUID.randomUUID());
            return r;
        });

        ContractRenewalResponse mockResp = ContractRenewalResponse.builder()
                .id(UUID.randomUUID())
                .cycleMonths(3)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockResp);

        ContractRenewalResponse response = contractRenewalService.requestRenewal(contractId, 3, "Gia hạn sớm");
        assertThat(response).isNotNull();
        assertThat(response.getCycleMonths()).isEqualTo(3);
    }

    @Test
    @DisplayName("requestRenewal should throw UNIT_OVERDUE_LOCKED when unit is sealed")
    void testRequestRenewalFailsWhenUnitIsSealed() {
        mockContract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.requestRenewal(contractId, 1, null));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNIT_OVERDUE_LOCKED);
    }

    @Test
    @DisplayName("handleRenewalSigned should complete renewal and extend contract when payment is already PAID")
    void testHandleRenewalSignedWithPaymentCompleted() {
        Payment mockPayment = Payment.builder()
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("6000000"))
                .build();
        mockRenewal.setPayment(mockPayment);

        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        contractRenewalService.handleRenewalSigned(renewalId, "https://docuseal.com/renewal.pdf");

        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.COMPLETED);
        assertThat(mockRenewal.getSignedDocumentUrl()).isEqualTo("https://docuseal.com/renewal.pdf");
        assertThat(mockContract.getEndDate()).isEqualTo(mockRenewal.getNewEndDate());

        verify(rentalContractRepository).save(mockContract);
        verify(contractRenewalRepository).save(mockRenewal);
        verify(activityLogService).recordSystem(any(UUID.class), eq(ActivityAction.CONTRACT_EXTENDED), anyString(), any(), anyString());
    }

    @Test
    @DisplayName("handleRenewalSigned should set PENDING_PAYMENT when payment has not been made yet")
    void testHandleRenewalSignedPendingPayment() {
        mockRenewal.setPayment(null);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        contractRenewalService.handleRenewalSigned(renewalId, "https://docuseal.com/renewal.pdf");

        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.PENDING_PAYMENT);
        assertThat(mockRenewal.getSignedDocumentUrl()).isEqualTo("https://docuseal.com/renewal.pdf");

        verify(contractRenewalRepository).save(mockRenewal);
        verify(rentalContractRepository, never()).save(mockContract);
    }

    @Test
    @DisplayName("handleRenewalPaid should complete renewal and extend contract when already signed")
    void testHandleRenewalPaidAlreadySigned() {
        mockRenewal.setSignedAt(LocalDateTime.now());
        mockRenewal.setSignedDocumentUrl("https://docuseal.com/renewal.pdf");

        Payment mockPayment = Payment.builder()
                .status(PaymentStatus.PAID)
                .contract(mockContract)
                .build();
        mockPayment.setId(UUID.randomUUID());

        when(contractRenewalRepository.findByPaymentId(mockPayment.getId())).thenReturn(Optional.of(mockRenewal));

        contractRenewalService.handleRenewalPaid(mockPayment);

        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.COMPLETED);
        assertThat(mockContract.getEndDate()).isEqualTo(mockRenewal.getNewEndDate());

        verify(rentalContractRepository).save(mockContract);
        verify(contractRenewalRepository).save(mockRenewal);
        verify(activityLogService).recordSystem(any(UUID.class), eq(ActivityAction.CONTRACT_EXTENDED), anyString(), any(), anyString());
    }

    @Test
    @DisplayName("approveRenewal should change status to PENDING_SIGNATURE and record activity log")
    void testApproveRenewalSuccess() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_REVIEW);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .status(ContractRenewalStatus.PENDING_SIGNATURE)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalResponse res = contractRenewalService.approveRenewal(renewalId, "Dong y gia han som");

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.PENDING_SIGNATURE);
        verify(activityLogService).record(any(UUID.class), eq(ActivityAction.RENEWAL_APPROVED), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("rejectRenewal should require reason and set status to REJECTED")
    void testRejectRenewalSuccess() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_REVIEW);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .status(ContractRenewalStatus.REJECTED)
                .rejectionReason("Kho bao tri")
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalResponse res = contractRenewalService.rejectRenewal(renewalId, "Kho bao tri");

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.REJECTED);
        assertThat(mockRenewal.getRejectionReason()).isEqualTo("Kho bao tri");
        verify(activityLogService).record(any(UUID.class), eq(ActivityAction.RENEWAL_REJECTED), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("rejectRenewal with blank reason should throw CONTRACT_RENEWAL_REJECTION_REASON_REQUIRED")
    void testRejectRenewalBlankReasonThrows() {
        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.rejectRenewal(renewalId, "  "));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_REJECTION_REASON_REQUIRED);
    }

    @Test
    @DisplayName("recordCounterPayment should create PAID payment and call handleRenewalPaid")
    void testRecordCounterPaymentSuccess() {
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .status(ContractRenewalStatus.PENDING_SIGNATURE)
                .paymentMethod("CASH")
                .receiptVoucherCode("PT-001")
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        var req = com.boxora.dto.request.ContractRenewalCounterPaymentRequest.builder()
                .paymentMethod("CASH")
                .receiptVoucherCode("PT-001")
                .notes("Khach nop tien mat")
                .build();

        ContractRenewalResponse res = contractRenewalService.recordCounterPayment(renewalId, req);

        assertThat(res).isNotNull();
        verify(paymentRepository).save(any(Payment.class));
        verify(activityLogService).record(any(UUID.class), eq(ActivityAction.PAYMENT_CONFIRMED), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("mockSignRenewal should sign addendum and trigger handleRenewalSigned")
    void testMockSignRenewalSuccess() {
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .status(ContractRenewalStatus.PENDING_PAYMENT)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        String validSig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        ContractRenewalResponse res = contractRenewalService.mockSignRenewal(renewalId, validSig);

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getSignedAt()).isNotNull();
        assertThat(mockRenewal.getSignatureData()).isEqualTo(validSig);
        verify(activityLogService).record(any(UUID.class), eq(ActivityAction.CONTRACT_SIGNED), anyString(), any(), anyString(), any(), any());
    }

    @Test
    @DisplayName("cancelRenewal should cancel unpaid pending renewal")
    void testCancelRenewalSuccess() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .status(ContractRenewalStatus.CANCELLED)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalResponse res = contractRenewalService.cancelRenewal(renewalId);

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.CANCELLED);
    }

    @Test
    @DisplayName("switchRenewalMethod should fail if renewal is still in PENDING_REVIEW")
    void testSwitchRenewalMethodFailsWhenPendingReview() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_REVIEW);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        com.boxora.dto.request.ContractRenewalSwitchMethodRequest req = com.boxora.dto.request.ContractRenewalSwitchMethodRequest.builder()
                .method("COUNTER")
                .appointmentDate(LocalDate.now().plusDays(2))
                .build();

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.switchRenewalMethod(renewalId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_NOT_APPROVED);
    }

    @Test
    @DisplayName("switchRenewalMethod to COUNTER should succeed with valid appointment date")
    void testSwitchRenewalMethodToCounterSuccess() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDate apptDate = LocalDate.now().plusDays(3);
        com.boxora.dto.request.ContractRenewalSwitchMethodRequest req = com.boxora.dto.request.ContractRenewalSwitchMethodRequest.builder()
                .method("COUNTER")
                .appointmentDate(apptDate)
                .notes("Hen den nop tien mat")
                .build();

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .paymentMethod("COUNTER")
                .counterAppointmentDate(apptDate)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalResponse res = contractRenewalService.switchRenewalMethod(renewalId, req);

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getPaymentMethod()).isEqualTo("COUNTER");
        assertThat(mockRenewal.getCounterAppointmentDate()).isEqualTo(apptDate);
        verify(contractRenewalRepository).save(mockRenewal);
    }

    @Test
    @DisplayName("switchRenewalMethod to COUNTER should fail when appointment date is missing")
    void testSwitchRenewalMethodToCounterFailsWithoutDate() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        com.boxora.dto.request.ContractRenewalSwitchMethodRequest req = com.boxora.dto.request.ContractRenewalSwitchMethodRequest.builder()
                .method("COUNTER")
                .appointmentDate(null)
                .build();

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.switchRenewalMethod(renewalId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_APPOINTMENT_DATE_REQUIRED);
    }

    @Test
    @DisplayName("switchRenewalMethod to COUNTER should fail when renewal was already signed online")
    void testSwitchRenewalMethodToCounterFailsWhenAlreadySigned() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_PAYMENT);
        mockRenewal.setSignedAt(LocalDateTime.now());
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        com.boxora.dto.request.ContractRenewalSwitchMethodRequest req = com.boxora.dto.request.ContractRenewalSwitchMethodRequest.builder()
                .method("COUNTER")
                .appointmentDate(LocalDate.now().plusDays(1))
                .build();

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.switchRenewalMethod(renewalId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_CANNOT_SWITCH_METHOD);
    }

    @Test
    @DisplayName("switchRenewalMethod to ONLINE should clear appointment date and set method ONLINE")
    void testSwitchRenewalMethodToOnlineSuccess() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        mockRenewal.setPaymentMethod("COUNTER");
        mockRenewal.setCounterAppointmentDate(LocalDate.now().plusDays(2));
        mockRenewal.setDocusealSubmitterSlug("slug-existing");

        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        com.boxora.dto.request.ContractRenewalSwitchMethodRequest req = com.boxora.dto.request.ContractRenewalSwitchMethodRequest.builder()
                .method("ONLINE")
                .build();

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .paymentMethod("ONLINE")
                .counterAppointmentDate(null)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalResponse res = contractRenewalService.switchRenewalMethod(renewalId, req);

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getPaymentMethod()).isEqualTo("ONLINE");
        assertThat(mockRenewal.getCounterAppointmentDate()).isNull();
    }

    @Test
    @DisplayName("reactivateRenewal should fail when renewal is not REJECTED")
    void testReactivateRenewalFailsWhenNotRejected() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_REVIEW);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.reactivateRenewal(renewalId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_NOT_REJECTED);
    }

    @Test
    @DisplayName("reactivateRenewal should fail when less than 3 days have passed since creation")
    void testReactivateRenewalFailsWhenTooEarly() {
        mockRenewal.setStatus(ContractRenewalStatus.REJECTED);
        mockRenewal.setCreatedAt(LocalDateTime.now().minusDays(2)); // Only 2 days ago
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.reactivateRenewal(renewalId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_REACTIVATE_TOO_EARLY);
    }

    @Test
    @DisplayName("reactivateRenewal should succeed when 3 or more days have passed")
    void testReactivateRenewalSuccess() {
        mockRenewal.setStatus(ContractRenewalStatus.REJECTED);
        mockRenewal.setRejectionReason("Khong hop le");
        mockRenewal.setCreatedAt(LocalDateTime.now().minusDays(3).minusHours(1));
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .status(ContractRenewalStatus.PENDING_REVIEW)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalResponse res = contractRenewalService.reactivateRenewal(renewalId);

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.PENDING_REVIEW);
        assertThat(mockRenewal.getRejectionReason()).isNull();
        verify(contractRenewalRepository).save(mockRenewal);
        verify(notificationLogRepository).save(any());
    }

    @Test
    @DisplayName("undoApproval should fail when renewal is not PENDING_SIGNATURE")
    void testUndoApprovalFailsWhenNotApproved() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_REVIEW);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.undoApproval(renewalId, "reconsider"));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_CANNOT_UNDO_APPROVAL);
    }

    @Test
    @DisplayName("undoApproval should fail when renewal was already signed")
    void testUndoApprovalFailsWhenAlreadySigned() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        mockRenewal.setSignedAt(LocalDateTime.now());
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.undoApproval(renewalId, "reconsider"));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_CANNOT_UNDO_APPROVAL);
    }

    @Test
    @DisplayName("undoApproval should succeed when approved and not signed/paid")
    void testUndoApprovalSuccess() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        mockRenewal.setSignedAt(null);
        mockRenewal.setPayment(null);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .status(ContractRenewalStatus.PENDING_REVIEW)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalResponse res = contractRenewalService.undoApproval(renewalId, "Thong tin can kiem tra lai");

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.PENDING_REVIEW);
        verify(contractRenewalRepository).save(mockRenewal);
    }

    @Test
    @DisplayName("assignStaff should fail when caller has role STAFF")
    void testAssignStaffFailsWhenRoleIsStaff() {
        when(requestContext.currentUserRole()).thenReturn("STAFF");

        ContractRenewalAssignStaffRequest req = ContractRenewalAssignStaffRequest.builder()
                .staffId(UUID.randomUUID())
                .build();

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.assignStaff(renewalId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    @DisplayName("assignStaff should fail when staff belongs to a different facility")
    void testAssignStaffFailsWhenFacilityMismatch() {
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        UUID staffId = UUID.randomUUID();
        User otherStaff = User.builder()
                .fullName("Staff Khac")
                .facility(Facility.builder().name("Boxora Khac").build())
                .build();
        otherStaff.getFacility().setId(UUID.randomUUID()); // Different facility ID
        when(userRepository.findById(staffId)).thenReturn(Optional.of(otherStaff));

        ContractRenewalAssignStaffRequest req = ContractRenewalAssignStaffRequest.builder()
                .staffId(staffId)
                .build();

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.assignStaff(renewalId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_STAFF_FACILITY_MISMATCH);
    }

    @Test
    @DisplayName("assignStaff should succeed when staff belongs to same facility and caller is manager")
    void testAssignStaffSuccess() {
        when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        UUID staffId = UUID.randomUUID();
        User sameStaff = User.builder()
                .fullName("Staff Quan 7")
                .facility(mockFacility) // Same facility
                .build();
        sameStaff.setId(staffId);
        when(userRepository.findById(staffId)).thenReturn(Optional.of(sameStaff));
        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .assignedStaffId(staffId)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalAssignStaffRequest req = ContractRenewalAssignStaffRequest.builder()
                .staffId(staffId)
                .build();

        ContractRenewalResponse res = contractRenewalService.assignStaff(renewalId, req);

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getAssignedStaff()).isEqualTo(sameStaff);
        assertThat(mockRenewal.getAssignedStaffAt()).isNotNull();
        verify(contractRenewalRepository).save(mockRenewal);
    }

    @Test
    @DisplayName("completeReception should fail when staff has no CHECKED_IN shift today")
    void testCompleteReceptionFailsWhenNotCheckedIn() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        UUID currentUserId = UUID.randomUUID();
        User currentUser = User.builder().fullName("Receptionist").facility(mockFacility).build();
        currentUser.setId(currentUserId);

        when(requestContext.currentUserId()).thenReturn(currentUserId);
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        when(userRepository.findById(currentUserId)).thenReturn(Optional.of(currentUser));
        // No checked in shift
        when(staffAssignmentRepository.findByStaff_IdAndAssignedDate(eq(currentUserId), any(LocalDate.class)))
                .thenReturn(List.of());

        ContractRenewalReceptionRequest req = ContractRenewalReceptionRequest.builder()
                .identityVerified(true)
                .unitAudited(true)
                .noBlockingIssues(true)
                .termsConfirmed(true)
                .paymentConfirmed(true)
                .paymentMethod("CASH")
                .build();

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.completeReception(renewalId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.STAFF_NOT_CHECKED_IN_SHIFT);
    }

    @Test
    @DisplayName("completeReception should fail when 6-point checklist is incomplete")
    void testCompleteReceptionFailsWhenChecklistIncomplete() {
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        UUID currentUserId = UUID.randomUUID();
        User currentUser = User.builder().fullName("Receptionist").facility(mockFacility).build();
        currentUser.setId(currentUserId);

        StaffAssignment assignment = StaffAssignment.builder()
                .staff(currentUser)
                .facility(mockFacility)
                .assignedDate(LocalDate.now())
                .status(StaffAssignmentStatus.CHECKED_IN)
                .build();

        when(requestContext.currentUserId()).thenReturn(currentUserId);
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        when(userRepository.findById(currentUserId)).thenReturn(Optional.of(currentUser));
        when(staffAssignmentRepository.findByStaff_IdAndAssignedDate(eq(currentUserId), any(LocalDate.class)))
                .thenReturn(List.of(assignment));

        // Missing unitAudited
        ContractRenewalReceptionRequest req = ContractRenewalReceptionRequest.builder()
                .identityVerified(true)
                .unitAudited(false)
                .noBlockingIssues(true)
                .termsConfirmed(true)
                .paymentConfirmed(true)
                .paymentMethod("CASH")
                .build();

        AppException ex = assertThrows(AppException.class, () -> contractRenewalService.completeReception(renewalId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CONTRACT_RENEWAL_RECEPTION_CHECKLIST_INCOMPLETE);
    }

    @Test
    @DisplayName("completeReception should succeed when checked in and all checklist points confirmed")
    void testCompleteReceptionSuccess() {
        mockContract.setEndDate(LocalDate.of(2027, 1, 19));
        mockRenewal.setStatus(ContractRenewalStatus.PENDING_SIGNATURE);
        mockRenewal.setCycleMonths(3);
        mockRenewal.setNewEndDate(LocalDate.of(2027, 4, 19));
        mockRenewal.setRenewalFee(new BigDecimal("3500000"));
        when(contractRenewalRepository.findById(renewalId)).thenReturn(Optional.of(mockRenewal));

        UUID currentUserId = UUID.randomUUID();
        User currentUser = User.builder().fullName("Receptionist").facility(mockFacility).build();
        currentUser.setId(currentUserId);

        StaffAssignment assignment = StaffAssignment.builder()
                .staff(currentUser)
                .facility(mockFacility)
                .assignedDate(LocalDate.now())
                .status(StaffAssignmentStatus.CHECKED_IN)
                .build();

        when(requestContext.currentUserId()).thenReturn(currentUserId);
        when(requestContext.currentUserRole()).thenReturn("STAFF");
        when(userRepository.findById(currentUserId)).thenReturn(Optional.of(currentUser));
        when(staffAssignmentRepository.findByStaff_IdAndAssignedDate(eq(currentUserId), any(LocalDate.class)))
                .thenReturn(List.of(assignment));

        when(contractRenewalRepository.save(any(ContractRenewal.class))).thenAnswer(inv -> inv.getArgument(0));
        when(rentalContractRepository.save(any(RentalContract.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        ContractRenewalResponse mockRes = ContractRenewalResponse.builder()
                .id(renewalId)
                .status(ContractRenewalStatus.COMPLETED)
                .build();
        when(contractRenewalMapper.toResponse(any())).thenReturn(mockRes);

        ContractRenewalReceptionRequest req = ContractRenewalReceptionRequest.builder()
                .identityVerified(true)
                .identityDocType("CCCD")
                .identityNumber("079201001234")
                .identityNotes("Chinh chu CCCD")
                .unitAudited(true)
                .unitAuditNotes("Kho kho rao, o khoa hoat dong tot")
                .noBlockingIssues(true)
                .termsConfirmed(true)
                .paymentConfirmed(true)
                .paymentMethod("CASH")
                .receptionNotes("Da thu tien mat va hoan tat bien ban tiep nhan")
                .signatureData("data:image/png;base64,iVBORw0KGgo...")
                .build();

        ContractRenewalResponse res = contractRenewalService.completeReception(renewalId, req);

        assertThat(res).isNotNull();
        assertThat(mockRenewal.getStatus()).isEqualTo(ContractRenewalStatus.COMPLETED);
        assertThat(mockRenewal.getHandledBy()).isEqualTo(currentUser);
        assertThat(mockRenewal.getHandledAt()).isNotNull();
        assertThat(mockRenewal.getIdentityVerified()).isTrue();
        assertThat(mockRenewal.getUnitAudited()).isTrue();
        assertThat(mockRenewal.getNoBlockingIssues()).isTrue();
        assertThat(mockRenewal.getTermsConfirmed()).isTrue();
        assertThat(mockRenewal.getPaymentConfirmed()).isTrue();
        assertThat(mockContract.getEndDate()).isEqualTo(LocalDate.of(2027, 4, 19)); // 2027-01-19 + 3 months
        verify(rentalContractRepository).save(mockContract);
        verify(contractRenewalRepository).save(mockRenewal);
        verify(activityLogService).record(any(), any(), any(), any(), any(), any(), any());
        verify(notificationLogRepository).save(any());
    }
}
