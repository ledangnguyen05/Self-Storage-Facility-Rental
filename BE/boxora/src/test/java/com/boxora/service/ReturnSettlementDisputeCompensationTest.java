package com.boxora.service;

import com.boxora.dto.request.CustomerDecisionRequest;
import com.boxora.dto.request.DisputeResolveRequest;
import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.request.ReturnPayoutRequest;
import com.boxora.dto.request.SettlementConfirmRequest;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.PaymentMapper;
import com.boxora.mapper.RentalContractMapper;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.HandoverServiceImpl;
import com.boxora.service.impl.PaymentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử Task 16: Quyết toán Trả kho, Khiếu nại, Hoàn tiền & Bồi thường VNPay Sandbox")
class ReturnSettlementDisputeCompensationTest {

    // HandoverService dependencies
    @Mock
    private HandoverRecordRepository handoverRecordRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private StorageUnitRepository storageUnitRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private RentalContractRepository rentalContractRepository;
    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;
    @Mock
    private RefundRequestRepository refundRequestRepository;
    @Mock
    private EncryptionService encryptionService;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private FacilityAccessGuard facilityAccessGuard;
    @Mock
    private RequestContext requestContext;
    @Mock
    private StorageUnitLockService storageUnitLockService;
    @Mock
    private NotificationLogRepository notificationLogRepository;
    @Mock
    private EmailService emailService;
    @Mock
    private FileStorageService fileStorageService;
    @Mock
    private SupportTicketRepository supportTicketRepository;
    @Mock
    private PaymentMapper paymentMapper;
    @Mock
    private RentalContractMapper rentalContractMapper;

    @InjectMocks
    private HandoverServiceImpl handoverService;

    // PaymentService dependencies
    @Mock
    private VNPayService vnPayService;
    @Mock
    private ObjectProvider<ContractRenewalService> contractRenewalServiceProvider;
    @Mock
    private com.boxora.config.DocuSealConfig docuSealConfig;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    private Facility testFacility;
    private StorageUnit testUnit;
    private User testCustomer;
    private User testStaff;
    private User testManager;
    private User testBusinessManager;
    private Booking testBooking;
    private RentalContract testContract;
    private HandoverRecord testReturnRecord;
    private UUID bookingId;
    private UUID customerId;
    private UUID staffId;
    private UUID managerId;
    private UUID bmId;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        customerId = UUID.randomUUID();
        staffId = UUID.randomUUID();
        managerId = UUID.randomUUID();
        bmId = UUID.randomUUID();

        testFacility = Facility.builder()
                .name("Boxora Bình Thạnh")
                .address("456 Điện Biên Phủ, Bình Thạnh")
                .build();
        testFacility.setId(UUID.randomUUID());

        testUnit = StorageUnit.builder()
                .unitCode("BT-C205")
                .facility(testFacility)
                .status(UnitStatus.OCCUPIED)
                .build();
        testUnit.setId(UUID.randomUUID());

        testCustomer = User.builder()
                .fullName("Trần Thị Mai")
                .email("mai.tran@boxora.vn")
                .phone("0912345678")
                .role(Role.builder().name("CUSTOMER").build())
                .build();
        testCustomer.setId(customerId);

        testStaff = User.builder()
                .fullName("Lê Văn Staff")
                .role(Role.builder().name("STAFF").build())
                .facility(testFacility)
                .build();
        testStaff.setId(staffId);

        testManager = User.builder()
                .fullName("Nguyễn Quản Lý")
                .role(Role.builder().name("FACILITY_MANAGER").build())
                .facility(testFacility)
                .build();
        testManager.setId(managerId);

        testBusinessManager = User.builder()
                .fullName("Phạm Kế Toán")
                .role(Role.builder().name("BUSINESS_MANAGER").build())
                .build();
        testBusinessManager.setId(bmId);

        testContract = RentalContract.builder()
                .contractCode("CTR-BT-C205")
                .depositHeld(new BigDecimal("1500000.00"))
                .monthlyFee(new BigDecimal("1200000.00"))
                .status(RentalContractStatus.ACTIVE)
                .startDate(LocalDate.now().minusMonths(1))
                .endDate(LocalDate.now())
                .build();
        testContract.setId(UUID.randomUUID());

        testBooking = Booking.builder()
                .bookingCode("BX-2026-T16")
                .customer(testCustomer)
                .storageUnit(testUnit)
                .facility(testFacility)
                .status(BookingStatus.INSPECTED)
                .depositAmount(new BigDecimal("1500000.00"))
                .depositPaid(new BigDecimal("1500000.00"))
                .startDate(LocalDate.now().minusMonths(1))
                .endDate(LocalDate.now())
                .stepTransitionHistory("")
                .build();
        testBooking.setId(bookingId);

        testReturnRecord = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .inspectionStatus("COMPLETED")
                .cleanlinessPassed(true)
                .doorConditionPassed(true)
                .wallStructurePassed(true)
                .smartLockPassed(true)
                .assetsClearedPassed(true)
                .sensorPassed(true)
                .deductionAmount(BigDecimal.ZERO)
                .refundAmount(new BigDecimal("1500000.00"))
                .additionalAmountDue(BigDecimal.ZERO)
                .settlementVersion(1)
                .unitReturnedPhysically(false)
                .accessRevoked(false)
                .recordedAt(LocalDateTime.now())
                .build();
        testReturnRecord.setId(UUID.randomUUID());

        lenient().when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
        lenient().when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(testBooking));
        lenient().when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));
        lenient().when(requestContext.currentUserId()).thenReturn(staffId);
        lenient().when(requestContext.currentUserRole()).thenReturn("STAFF");
        lenient().when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
        lenient().when(userRepository.findById(managerId)).thenReturn(Optional.of(testManager));
        lenient().when(userRepository.findById(bmId)).thenReturn(Optional.of(testBusinessManager));
        lenient().when(handoverRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(storageUnitRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(bookingId, "RETURN"))
                .thenReturn(Optional.of(testReturnRecord));
        lenient().when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId))
                .thenReturn(List.of(testReturnRecord));
    }

    // =========================================================================
    // 16.1 & 16.2: Xác nhận đối soát & Công bố 2 kịch bản (Outcome A vs B)
    // =========================================================================
    @Test
    @DisplayName("Task 16.1 & 16.2 Outcome B: Cọc > Khấu trừ -> netRefund > 0, additionalDue = 0, version 1 chốt")
    void test16_OutcomeB_NetRefund_Confirmed() {
        // Cọc: 1.500.000đ, Vệ sinh: 300.000đ -> Hoàn 1.200.000đ
        testReturnRecord.setCleanlinessFee(new BigDecimal("300000.00"));
        testReturnRecord.setCleanlinessNotes("Cần dọn bụi bẩn");

        SettlementConfirmRequest req = SettlementConfirmRequest.builder()
                .notes("Đã kiểm tra hiện trường & tính phí")
                .build();

        ReturnSettlementResponse res = handoverService.confirmSettlementCalculation(bookingId, req);

        assertThat(res).isNotNull();
        assertThat(testReturnRecord.getSettlementConfirmed()).isTrue();
        assertThat(testReturnRecord.getSettlementVersion()).isEqualTo(1);
        assertThat(testReturnRecord.getCustomerDecision()).isEqualTo("PENDING");
        assertThat(res.getDepositPaid()).isEqualByComparingTo(new BigDecimal("1500000.00"));
        assertThat(res.getNetRefundAmount()).isEqualByComparingTo(new BigDecimal("1200000.00"));
        assertThat(res.getAdditionalAmountDue()).isEqualByComparingTo(BigDecimal.ZERO);

        verify(notificationLogRepository, atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("Task 16.1 & 16.2 Outcome A: Khấu trừ > Cọc -> additionalDue > 0, netRefund = 0")
    void test16_OutcomeA_AdditionalDue_Confirmed() {
        // Cọc: 1.500.000đ, Cửa: 2.000.000đ -> Nộp thêm 500.000đ, Hoàn 0đ
        testReturnRecord.setDoorFee(new BigDecimal("2000000.00"));
        testReturnRecord.setDoorNotes("Cửa cuốn bị hỏng nan");

        SettlementConfirmRequest req = SettlementConfirmRequest.builder()
                .notes("Khấu trừ vượt tiền cọc")
                .build();

        ReturnSettlementResponse res = handoverService.confirmSettlementCalculation(bookingId, req);

        assertThat(res).isNotNull();
        assertThat(testReturnRecord.getSettlementConfirmed()).isTrue();
        assertThat(res.getNetRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(res.getAdditionalAmountDue()).isEqualByComparingTo(new BigDecimal("500000.00"));
    }

    @Test
    @DisplayName("Task 16.1: Không cho phép xác nhận quyết toán nếu chưa có biên bản kiểm tra")
    void test16_ConfirmSettlement_ThrowsIfNoInspection() {
        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId))
                .thenReturn(Collections.emptyList());

        SettlementConfirmRequest req = SettlementConfirmRequest.builder().build();

        AppException ex = assertThrows(AppException.class, () -> handoverService.confirmSettlementCalculation(bookingId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_NOT_INSPECTED);
    }

    // =========================================================================
    // 16.3: Phản hồi của Khách Hàng (Đồng ý vs Khiếu nại) & FM Phân xử
    // =========================================================================
    @Test
    @DisplayName("Task 16.3: Khách hàng gửi khiếu nại -> Trạng thái DISPUTED, lưu lý do")
    void test16_CustomerDisputes_SetsDisputedStatus() {
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setSettlementVersion(1);

        CustomerDecisionRequest req = CustomerDecisionRequest.builder()
                .decision("DISPUTED")
                .disputeReason("Cửa cuốn đã bị kẹt từ trước khi nhận kho")
                .disputeEvidenceUrls("https://boxora.vn/cuacuon_cu.jpg")
                .build();

        ReturnSettlementResponse res = handoverService.handleCustomerDecision(bookingId, req);

        assertThat(testReturnRecord.getCustomerDecision()).isEqualTo("DISPUTED");
        assertThat(testReturnRecord.getDisputeReason()).contains("Cửa cuốn đã bị kẹt");
        assertThat(testReturnRecord.getApprovalStatus()).isEqualTo("DISPUTED");
    }

    @Test
    @DisplayName("Task 16.3: Chỉ FACILITY_MANAGER mới có quyền phân xử khiếu nại, STAFF bị từ chối")
    void test16_ResolveDispute_RBAC_Enforced() {
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setCustomerDecision("DISPUTED");
        testReturnRecord.setApprovalStatus("DISPUTED");

        // STAFF attempts to resolve
        when(requestContext.currentUserId()).thenReturn(staffId);

        DisputeResolveRequest req = DisputeResolveRequest.builder()
                .action("UPHOLD_SETTLEMENT")
                .resolutionNote("Từ chối khiếu nại")
                .build();

        AppException ex = assertThrows(AppException.class, () -> handoverService.resolveDispute(bookingId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_UNAUTHORIZED_APPROVAL);
    }

    @Test
    @DisplayName("Task 16.3 Option A: FM điều chỉnh giảm chi phí -> Tăng version lên 2, yêu cầu khách duyệt lại")
    void test16_FM_ResolvesDispute_OptionA_Adjust() {
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setSettlementVersion(1);
        testReturnRecord.setCustomerDecision("DISPUTED");
        testReturnRecord.setApprovalStatus("DISPUTED");
        testReturnRecord.setDoorFee(new BigDecimal("1000000.00"));

        when(requestContext.currentUserId()).thenReturn(managerId);

        DisputeResolveRequest req = DisputeResolveRequest.builder()
                .action("ADJUST_SETTLEMENT")
                .adjustedDoorFee(new BigDecimal("400000.00"))
                .resolutionNote("Hỗ trợ giảm 600.000đ phí sửa cửa")
                .build();

        ReturnSettlementResponse res = handoverService.resolveDispute(bookingId, req);

        assertThat(testReturnRecord.getSettlementVersion()).isEqualTo(2);
        assertThat(testReturnRecord.getCustomerDecision()).isEqualTo("PENDING");
        assertThat(testReturnRecord.getDoorFee()).isEqualByComparingTo(new BigDecimal("400000.00"));
        assertThat(testReturnRecord.getDisputeResolvedBy()).isEqualTo(testManager);
        verify(notificationLogRepository, atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("Task 16.3 Option B: FM giữ nguyên quyết định -> Ghi chú giải thích, yêu cầu khách xem xét lại")
    void test16_FM_ResolvesDispute_OptionB_Uphold() {
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setSettlementVersion(1);
        testReturnRecord.setCustomerDecision("DISPUTED");
        testReturnRecord.setApprovalStatus("DISPUTED");
        testReturnRecord.setDoorFee(new BigDecimal("800000.00"));

        when(requestContext.currentUserId()).thenReturn(managerId);

        DisputeResolveRequest req = DisputeResolveRequest.builder()
                .action("UPHOLD_SETTLEMENT")
                .resolutionNote("Biên bản ban đầu đã ghi nhận cửa hoạt động tốt")
                .build();

        ReturnSettlementResponse res = handoverService.resolveDispute(bookingId, req);

        assertThat(testReturnRecord.getSettlementVersion()).isEqualTo(1);
        assertThat(testReturnRecord.getCustomerDecision()).isEqualTo("PENDING");
        assertThat(testReturnRecord.getDisputeResolutionNote()).contains("Biên bản ban đầu");
        assertThat(testReturnRecord.getApprovalStatus()).isEqualTo("DISPUTE_UPHELD");
    }

    // =========================================================================
    // 16.4: Khách Hàng Đồng Ý & Giải Ngân Hoàn Cọc
    // =========================================================================
    @Test
    @DisplayName("Task 16.4: Khách đồng ý & cung cấp số tài khoản nhận tiền hoàn cọc")
    void test16_CustomerAgreed_ProvidesBankDetails() {
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setRefundAmount(new BigDecimal("1000000.00"));
        testReturnRecord.setDeductionAmount(new BigDecimal("500000.00"));

        CustomerDecisionRequest req = CustomerDecisionRequest.builder()
                .decision("AGREED")
                .bankName("Vietcombank")
                .bankAccountNumber("0123456789")
                .bankAccountName("TRAN THI MAI")
                .build();

        when(refundRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ReturnSettlementResponse res = handoverService.handleCustomerDecision(bookingId, req);

        assertThat(testReturnRecord.getCustomerDecision()).isEqualTo("AGREED");
        assertThat(testReturnRecord.getBankName()).isEqualTo("Vietcombank");
        assertThat(testReturnRecord.getBankAccountNumber()).isEqualTo("0123456789");
        assertThat(testReturnRecord.getBankAccountName()).isEqualTo("TRAN THI MAI");
        assertThat(testReturnRecord.getRefundStatus()).isEqualTo("PENDING_PAYOUT");
    }

    @Test
    @DisplayName("Task 16.4: Kế toán thực hiện chuyển khoản hoàn tiền -> Ghi nhận mã GD, cập nhật COMPLETED")
    void test16_BM_ExecutesPayout_Success() {
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setCustomerDecision("AGREED");
        testReturnRecord.setRefundAmount(new BigDecimal("1000000.00"));
        testReturnRecord.setBankName("Vietcombank");
        testReturnRecord.setBankAccountNumber("0123456789");
        testReturnRecord.setBankAccountName("TRAN THI MAI");

        RefundRequest refundReq = RefundRequest.builder()
                .booking(testBooking)
                .requestedAmount(new BigDecimal("1000000.00"))
                .finalRefundAmount(new BigDecimal("1000000.00"))
                .status(RefundStatus.APPROVED)
                .build();
        refundReq.setId(UUID.randomUUID());
        testReturnRecord.setRefundRequest(refundReq);

        when(requestContext.currentUserId()).thenReturn(bmId);
        when(refundRequestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ReturnPayoutRequest req = ReturnPayoutRequest.builder()
                .transactionReference("FT260291234567")
                .transferProofUrl("https://boxora.vn/proof_transfer.pdf")
                .processNotes("Đã chuyển khoản thành công")
                .build();

        ReturnSettlementResponse res = handoverService.executePayout(bookingId, req);

        assertThat(testReturnRecord.getRefundTxnRef()).isEqualTo("FT260291234567");
        assertThat(testReturnRecord.getRefundStatus()).isEqualTo("REFUNDED");
        assertThat(refundReq.getStatus()).isEqualTo(RefundStatus.COMPLETED);
    }

    @Test
    @DisplayName("Task 16.4: Chặn giải ngân hoàn cọc nếu khách hàng chưa đồng ý hoặc đang khiếu nại")
    void test16_Payout_BlockedIfCustomerNotAgreed() {
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setCustomerDecision("DISPUTED"); // Chưa đồng ý

        when(requestContext.currentUserId()).thenReturn(bmId);

        ReturnPayoutRequest req = ReturnPayoutRequest.builder()
                .transactionReference("FT999")
                .build();

        AppException ex = assertThrows(AppException.class, () -> handoverService.executePayout(bookingId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
    }

    // =========================================================================
    // 16.5: Bồi thường qua cổng VNPay Sandbox (RETURN_COMPENSATION)
    // =========================================================================
    @Test
    @DisplayName("Task 16.5: Tạo link thanh toán VNPay RETURN_COMPENSATION, xác thực số tiền từ server snapshot")
    void test16_CreateVNPayCompensation_ServerEnforcedAmount() {
        // Cọc: 1.500.000đ, Khấu trừ: 2.000.000đ -> Bồi thường 500.000đ
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setCustomerDecision("AGREED");
        testReturnRecord.setAdditionalAmountDue(new BigDecimal("500000.00"));
        testReturnRecord.setAdditionalPaymentStatus("PENDING");

        PaymentCreateRequest req = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .amount(new BigDecimal("500000.00"))
                .paymentType(PaymentType.RETURN_COMPENSATION)
                .build();

        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        when(vnPayService.createPaymentUrl(anyString(), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn("https://sandbox.vnpayment.vn/pay?tx=123");

        VNPayPaymentResponse resp = paymentService.createVNPayPayment(req, null);

        assertThat(resp).isNotNull();
        assertThat(resp.getPaymentUrl()).contains("sandbox.vnpayment.vn");
        assertThat(resp.getAmount()).isEqualByComparingTo(new BigDecimal("500000.00"));
        verify(paymentRepository).save(argThat(p ->
                p.getPaymentType() == PaymentType.RETURN_COMPENSATION &&
                p.getAmount().compareTo(new BigDecimal("500000.00")) == 0
        ));
    }

    @Test
    @DisplayName("Task 16.5: Lỗi khi hồ sơ không có khoản bồi thường mà yêu cầu thanh toán")
    void test16_CreateVNPayCompensation_NoAdditionalDue_ThrowsException() {
        testReturnRecord.setSettlementConfirmed(true);
        testReturnRecord.setCustomerDecision("AGREED");
        testReturnRecord.setAdditionalAmountDue(BigDecimal.ZERO); // Không nợ

        PaymentCreateRequest req = PaymentCreateRequest.builder()
                .bookingId(bookingId)
                .amount(new BigDecimal("500000.00"))
                .paymentType(PaymentType.RETURN_COMPENSATION)
                .build();

        AppException ex = assertThrows(AppException.class, () -> paymentService.createVNPayPayment(req, null));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
    }

    @Test
    @DisplayName("Task 16.5: IPN/Return VNPay thành công cập nhật additionalPaymentStatus = PAID")
    void test16_ProcessVNPayReturn_ReturnCompensation_MarksPaid() {
        UUID paymentId = UUID.randomUUID();
        Payment compPayment = Payment.builder()
                .booking(testBooking)
                .amount(new BigDecimal("500000.00"))
                .paymentType(PaymentType.RETURN_COMPENSATION)
                .status(PaymentStatus.PENDING)
                .transactionId("BOX123456789")
                .build();
        compPayment.setId(paymentId);

        when(vnPayService.verifySignature(any())).thenReturn(true);
        when(paymentRepository.findByTransactionIdForUpdate("BOX123456789")).thenReturn(Optional.of(compPayment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        PaymentResponse mockResp = PaymentResponse.builder()
                .id(paymentId)
                .transactionId("BOX123456789")
                .bookingId(bookingId)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("500000.00"))
                .build();
        when(paymentMapper.toResponse(any(Payment.class))).thenReturn(mockResp);

        Map<String, String> vnpParams = new HashMap<>();
        vnpParams.put("vnp_TxnRef", "BOX123456789");
        vnpParams.put("vnp_Amount", "50000000");
        vnpParams.put("vnp_ResponseCode", "00");
        vnpParams.put("vnp_TransactionStatus", "00");
        vnpParams.put("vnp_TransactionNo", "VNP14892341");
        vnpParams.put("vnp_PayDate", "20261029220000");

        PaymentResponse result = paymentService.processVNPayReturn(vnpParams);

        assertThat(result.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(compPayment.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(testReturnRecord.getAdditionalPaymentStatus()).isEqualTo("PAID");
        assertThat(testReturnRecord.getAdditionalPaymentTxnRef()).isEqualTo("BOX123456789");
        // Đảm bảo không kích hoạt booking sang CONFIRMED hay ACTIVE
        assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.INSPECTED);
    }

    // =========================================================================
    // 16.6: Nhận lại kho vật lý & Tự động thu hồi SmartLock IoT PIN
    // =========================================================================
    @Test
    @DisplayName("Task 16.6: Xác nhận nhận lại kho vật lý tự động thu hồi SmartLock PIN và giải phóng khóa")
    void test16_PhysicalReturn_AutoRevokesSmartLockPin() {
        testReturnRecord.setAssetsClearedPassed(true);

        when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));

        HandoverResponse res = handoverService.confirmPhysicalReturn(bookingId, HandoverRequest.builder().build());

        assertThat(res).isNotNull();
        assertThat(testReturnRecord.getPhysicalHandoverConfirmed()).isTrue();
        assertThat(testReturnRecord.getAccessRevoked()).isTrue();
        assertThat(testBooking.getAccessPin()).isNull();
        verify(storageUnitLockService, atLeastOnce()).releaseLock(eq(testUnit.getId()));
    }
}
