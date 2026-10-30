package com.boxora.service;

import com.boxora.dto.request.HandoverRequest;
import com.boxora.dto.response.HandoverResponse;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.ReturnSettlementResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.HandoverServiceImpl;
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
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Kiểm thử toàn diện 22 kịch bản Nghiệp vụ Trả Kho Boxora (Warehouse Return Settlement Workflow)")
class WarehouseReturnServiceTest {

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

    @InjectMocks
    private HandoverServiceImpl handoverService;

    private Facility testFacility;
    private StorageUnit testUnit;
    private User testCustomer;
    private User testStaff;
    private User testManager;
    private Booking testBooking;
    private RentalContract testContract;
    private UUID bookingId;
    private UUID staffId;
    private UUID managerId;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        staffId = UUID.randomUUID();
        managerId = UUID.randomUUID();

        testFacility = Facility.builder()
                .name("Boxora Thủ Đức")
                .address("123 Võ Văn Ngân, TP Thủ Đức")
                .build();
        testFacility.setId(UUID.randomUUID());

        testUnit = StorageUnit.builder()
                .unitCode("TD-B102")
                .facility(testFacility)
                .status(UnitStatus.OCCUPIED)
                .build();
        testUnit.setId(UUID.randomUUID());

        testCustomer = User.builder()
                .fullName("Nguyễn Văn An")
                .email("an.nguyen@boxora.vn")
                .phone("0987654321")
                .role(Role.builder().name("CUSTOMER").build())
                .build();
        testCustomer.setId(UUID.randomUUID());

        testStaff = User.builder()
                .fullName("Phan Văn Hậu")
                .email("hau.phan@boxora.vn")
                .role(Role.builder().name("STAFF").build())
                .facility(testFacility)
                .build();
        testStaff.setId(staffId);

        testManager = User.builder()
                .fullName("Trần Quản Lý")
                .email("quanly@boxora.vn")
                .role(Role.builder().name("FACILITY_MANAGER").build())
                .facility(testFacility)
                .build();
        testManager.setId(managerId);

        testBooking = Booking.builder()
                .bookingCode("BX-2026-8801")
                .customer(testCustomer)
                .storageUnit(testUnit)
                .facility(testFacility)
                .status(BookingStatus.ACTIVE)
                .depositAmount(new BigDecimal("3500000.00"))
                .depositPaid(new BigDecimal("3500000.00"))
                .startDate(LocalDate.now().minusMonths(1))
                .endDate(LocalDate.now())
                .stepTransitionHistory("")
                .build();
        testBooking.setId(bookingId);

        testContract = RentalContract.builder()
                .contractCode("CTR-BX-8801")
                .booking(testBooking)
                .customer(testCustomer)
                .unit(testUnit)
                .facility(testFacility)
                .status(RentalContractStatus.ACTIVE)
                .monthlyFee(new BigDecimal("1500000.00"))
                .build();
        testContract.setId(UUID.randomUUID());

        // Lenient common defaults to avoid repetitive mocking
        lenient().when(bookingRepository.findById(bookingId)).thenReturn(Optional.of(testBooking));
        lenient().when(bookingRepository.findByIdForUpdate(bookingId)).thenReturn(Optional.of(testBooking));
        lenient().when(requestContext.currentUserId()).thenReturn(staffId);
        lenient().when(userRepository.findById(staffId)).thenReturn(Optional.of(testStaff));
        lenient().when(userRepository.findById(managerId)).thenReturn(Optional.of(testManager));
        lenient().when(handoverRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(storageUnitRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // =========================================================================
    // 1. Hồ sơ hợp lệ, kho sạch, không hư hại, đủ ảnh (>= 2 ảnh)
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 1: Hồ sơ hợp lệ, kho sạch, không hư hại, đủ 2 ảnh -> Nghiệm thu ĐẠT CHUẨN")
    void scenario01_ValidInspection_AllPassed_Succeeds() {
        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(Collections.emptyList());

        HandoverRequest req = HandoverRequest.builder()
                .bookingId(bookingId)
                .isDraft(false)
                .doorConditionPassed(true)
                .cleanlinessPassed(true)
                .wallStructurePassed(true)
                .smartLockPassed(true)
                .assetsClearedPassed(true)
                .sensorPassed(true)
                .evidencePhotos(List.of("https://boxora.vn/photo1.jpg", "https://boxora.vn/photo2.jpg"))
                .notes("Kho hoàn hảo")
                .build();

        HandoverResponse response = handoverService.saveInspection(req);

        assertThat(response).isNotNull();
        assertThat(response.getInspectionStatus()).isIn("INSPECTION_PASSED", "COMPLETED");
        assertThat(response.getChecklistAllPassed()).isTrue();
        assertThat(response.getDoorConditionPassed()).isTrue();
        assertThat(response.getCleanlinessPassed()).isTrue();
        assertThat(response.getAssetsClearedPassed()).isTrue();
    }

    // =========================================================================
    // 2. Thiếu ảnh bắt buộc (< 2 ảnh), không được chốt biên bản
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 2: Thiếu ảnh bắt buộc (< 2 ảnh) -> Ném lỗi RETURN_PHOTO_COUNT_INSUFFICIENT")
    void scenario02_InsufficientPhotos_ThrowsException() {
        HandoverRequest req = HandoverRequest.builder()
                .bookingId(bookingId)
                .isDraft(false)
                .doorConditionPassed(true)
                .cleanlinessPassed(true)
                .wallStructurePassed(true)
                .smartLockPassed(true)
                .assetsClearedPassed(true)
                .sensorPassed(true)
                .evidencePhotos(List.of("https://boxora.vn/only-one-photo.jpg")) // Chỉ 1 ảnh
                .notes("Thiếu ảnh")
                .build();

        AppException ex = assertThrows(AppException.class, () -> handoverService.saveInspection(req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_PHOTO_COUNT_INSUFFICIENT);
        assertThat(ex.getMessage()).contains("tối thiểu 2 ảnh");
    }

    // =========================================================================
    // 3. Có hư hại nhưng chưa được duyệt, không được đưa vào khoản khấu trừ cuối cùng
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 3: Có hư hại nhưng chưa được duyệt -> Cấm hoàn tất, ném RETURN_APPROVAL_REQUIRED")
    void scenario03_UnapprovedDamage_CannotCompleteReturn() {
        HandoverRecord pendingApprovalRecord = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .inspectionStatus("COMPLETED")
                .assetsClearedPassed(true)
                .approvalStatus("PENDING_APPROVAL")
                .deductionAmount(new BigDecimal("800000.00"))
                .unitReturnedPhysically(true)
                .accessRevoked(true)
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId))
                .thenReturn(List.of(pendingApprovalRecord));

        AppException ex = assertThrows(AppException.class, () -> handoverService.completeReturn(bookingId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_APPROVAL_REQUIRED);
        assertThat(ex.getMessage()).contains("quản lý phê duyệt");
    }

    // =========================================================================
    // 4. Smart Lock lỗi do nguyên nhân chưa xác định / hao mòn
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 4: Smart Lock lỗi do nguyên nhân chưa xác định -> Khách chịu 0đ, không trừ cọc")
    void scenario04_SmartLockNormalWear_NoCustomerDeduction() {
        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(Collections.emptyList());

        HandoverRequest req = HandoverRequest.builder()
                .bookingId(bookingId)
                .isDraft(false)
                .doorConditionPassed(true)
                .cleanlinessPassed(true)
                .wallStructurePassed(true)
                .smartLockPassed(false) // Báo lỗi
                .smartLockFee(new BigDecimal("4000000.00")) // Tiền sửa chữa thiết bị
                .smartLockIssueType("PENDING_VERIFICATION") // Chưa xác định nguyên nhân
                .assetsClearedPassed(true)
                .sensorPassed(true)
                .evidencePhotos(List.of("https://photo1.jpg", "https://photo2.jpg"))
                .build();

        HandoverResponse response = handoverService.saveInspection(req);

        // Chi phí khấu trừ của khách phải là 0đ vì không phải CUSTOMER_FAULT!
        assertThat(response.getDeductionAmount()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    // =========================================================================
    // 5. Chi phí sửa chữa nhỏ hơn tiền cọc (Repair < Deposit)
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 5: Chi phí sửa chữa < tiền cọc -> Cấn trừ đúng, hoàn trả phần dư")
    void scenario05_RepairCostLessThanDeposit_RefundsRemaining() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .doorConditionPassed(false)
                .doorFee(new BigDecimal("1000000.00"))
                .cleanlinessPassed(true)
                .wallStructurePassed(true)
                .smartLockPassed(true)
                .assetsClearedPassed(true)
                .sensorPassed(true)
                .approvalStatus("APPROVED")
                .approvedDeductions(new BigDecimal("1000000.00"))
                .deductionAmount(new BigDecimal("1000000.00"))
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(Collections.emptyList());

        ReturnSettlementResponse settlement = handoverService.calculateSettlement(bookingId, null);

        assertThat(settlement.getDepositPaid()).isEqualByComparingTo(new BigDecimal("3500000.00"));
        assertThat(settlement.getApprovedDeductions()).isEqualByComparingTo(new BigDecimal("1000000.00"));
        assertThat(settlement.getNetRefundAmount()).isEqualByComparingTo(new BigDecimal("2500000.00"));
        assertThat(settlement.getAdditionalAmountDue()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    // =========================================================================
    // 6. Chi phí sửa chữa bằng tiền cọc (Repair == Deposit)
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 6: Chi phí sửa chữa = tiền cọc -> Hoàn 0đ, không nợ thêm")
    void scenario06_RepairCostEqualsDeposit_RefundZero() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .approvalStatus("APPROVED")
                .approvedDeductions(new BigDecimal("3500000.00"))
                .deductionAmount(new BigDecimal("3500000.00"))
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(Collections.emptyList());

        ReturnSettlementResponse settlement = handoverService.calculateSettlement(bookingId, null);

        assertThat(settlement.getNetRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(settlement.getAdditionalAmountDue()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    // =========================================================================
    // 7. Chi phí sửa chữa lớn hơn tiền cọc (Repair > Deposit)
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 7: Chi phí sửa chữa > tiền cọc -> Cấn trừ hết cọc, phát sinh khoản thu bổ sung, cấm cọc âm")
    void scenario07_RepairCostExceedsDeposit_AdditionalDueRecorded() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .doorConditionPassed(false)
                .doorFee(new BigDecimal("300000.00"))
                .wallStructurePassed(false)
                .wallStructureFee(new BigDecimal("500000.00"))
                .smartLockPassed(false)
                .smartLockFee(new BigDecimal("4060000.00"))
                .smartLockIssueType("CUSTOMER_FAULT")
                .cleanlinessPassed(true)
                .assetsClearedPassed(true)
                .sensorPassed(true)
                .approvalStatus("APPROVED")
                .approvedDeductions(new BigDecimal("4860000.00"))
                .deductionAmount(new BigDecimal("4860000.00"))
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(Collections.emptyList());

        ReturnSettlementResponse settlement = handoverService.calculateSettlement(bookingId, null);

        assertThat(settlement.getNetRefundAmount()).isEqualByComparingTo(BigDecimal.ZERO); // Không âm!
        assertThat(settlement.getAdditionalAmountDue()).isEqualByComparingTo(new BigDecimal("1360000.00"));
    }

    // =========================================================================
    // 8. Công nợ được phép khấu trừ
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 8: Công nợ trễ hạn chưa thanh toán -> Được khấu trừ hợp lệ cùng chi phí hư hại")
    void scenario08_OverdueDebt_EligibleForDeduction() {
        FacilityPolicy policy = FacilityPolicy.builder()
                .facility(testFacility)
                .dailyLateFee(new BigDecimal("100000.00"))
                .overdueGraceDays(0)
                .isActive(true)
                .build();
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(any()))
                .thenReturn(Optional.of(policy));

        testBooking.setEndDate(LocalDate.now().minusDays(5)); // Trễ 5 ngày -> 5 * 100.000 = 500.000đ

        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .cleanlinessPassed(false)
                .cleanlinessFee(new BigDecimal("150000.00"))
                .deductionAmount(new BigDecimal("150000.00"))
                .approvalStatus("APPROVED")
                .approvedDeductions(new BigDecimal("150000.00"))
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        ReturnSettlementResponse settlement = handoverService.calculateSettlement(bookingId, null);

        assertThat(settlement.getOverdueDebt()).isEqualByComparingTo(new BigDecimal("500000.00"));
        assertThat(settlement.getNetRefundAmount()).isEqualByComparingTo(new BigDecimal("2850000.00"));
    }

    // =========================================================================
    // 9. Tránh khấu trừ hoặc thu công nợ trùng
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 9: Tránh tính trùng công nợ đã trả hoặc các khoản khấu trừ trùng")
    void scenario09_AvoidDoubleDeduction() {
        Payment paidRent = Payment.builder()
                .paymentType(PaymentType.RENTAL_FEE)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("1500000.00"))
                .build();

        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .cleanlinessPassed(true)
                .wallStructurePassed(true)
                .doorConditionPassed(true)
                .smartLockPassed(true)
                .assetsClearedPassed(true)
                .sensorPassed(true)
                .deductionAmount(BigDecimal.ZERO)
                .approvalStatus("APPROVED")
                .approvedDeductions(BigDecimal.ZERO)
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));
        when(paymentRepository.findAllByBooking_Id(bookingId)).thenReturn(List.of(paidRent));

        ReturnSettlementResponse settlement = handoverService.calculateSettlement(bookingId, null);

        assertThat(settlement.getOverdueDebt()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(settlement.getNetRefundAmount()).isEqualByComparingTo(new BigDecimal("3500000.00"));
    }

    // =========================================================================
    // 10. Nhân viên cố tự duyệt khoản vượt quyền
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 10: STAFF cố tự duyệt khoản khấu trừ -> Ném lỗi RETURN_UNAUTHORIZED_APPROVAL")
    void scenario10_StaffAttemptsApproval_ThrowsException() {
        HandoverRequest req = HandoverRequest.builder()
                .approvalAction("APPROVE")
                .approvedDeductionAmount(new BigDecimal("500000.00"))
                .build();

        AppException ex = assertThrows(AppException.class, () -> handoverService.approveSettlement(bookingId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_UNAUTHORIZED_APPROVAL);
        assertThat(ex.getMessage()).contains("Nhân viên không có quyền");
    }

    // =========================================================================
    // 11. Quản lý cơ sở duyệt vượt hạn mức 5.000.000đ
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 11: FACILITY_MANAGER duyệt vượt hạn mức 5.000.000đ -> Ném lỗi hạn mức")
    void scenario11_ManagerExceedsThreshold_ThrowsException() {
        when(requestContext.currentUserId()).thenReturn(managerId);

        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .inspectionStatus("COMPLETED")
                .build();
        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        HandoverRequest req = HandoverRequest.builder()
                .approvalAction("APPROVE")
                .approvedDeductionAmount(new BigDecimal("6000000.00")) // Vượt hạn mức 5 triệu
                .build();

        AppException ex = assertThrows(AppException.class, () -> handoverService.approveSettlement(bookingId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_UNAUTHORIZED_APPROVAL);
        assertThat(ex.getMessage()).contains("vượt hạn mức");
    }

    // =========================================================================
    // 12. Nhân viên khác chi nhánh truy cập hồ sơ
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 12: Nhân viên khác chi nhánh truy cập hồ sơ -> FacilityAccessGuard ném lỗi FACILITY_ACCESS_DENIED")
    void scenario12_CrossFacilityAccess_Denied() {
        doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED))
                .when(facilityAccessGuard).checkFacilityAccess(testFacility.getId());

        assertThrows(AppException.class, () -> handoverService.getReturnCaseDetail(bookingId));
    }

    // =========================================================================
    // 13. Khách không đồng ý khoản bồi thường (Khiếu nại)
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 13: Khách không đồng ý bồi thường -> Ghi nhận tranh chấp DISPUTED")
    void scenario13_CustomerDispute_MovesToDisputedStatus() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .inspectionStatus("INSPECTION_ISSUE")
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        HandoverResponse updated = handoverService.recordCustomerDispute(bookingId, "Khách không đồng ý giá sửa cửa cuốn");

        assertThat(updated.getApprovalStatus()).isEqualTo("DISPUTED");
        assertThat(record.getNotes()).contains("Khách không đồng ý giá sửa cửa cuốn");
    }

    // =========================================================================
    // 14. Bấm lặp nút thu tiền bổ sung
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 14: Bấm lặp nút thu tiền bổ sung -> Ném lỗi RETURN_ADDITIONAL_PAYMENT_ALREADY_PAID")
    void scenario14_DuplicateAdditionalPayment_ThrowsException() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .additionalPaymentStatus("PAID")
                .additionalPaymentTxnRef("REC-123456")
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        HandoverRequest req = HandoverRequest.builder()
                .additionalPaymentMethod("CASH")
                .build();

        AppException ex = assertThrows(AppException.class, () -> handoverService.collectAdditionalPayment(bookingId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_ADDITIONAL_PAYMENT_ALREADY_PAID);
    }

    // =========================================================================
    // 15. Bấm lặp nút hoàn tiền cọc
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 15: Bấm lặp nút hoàn tiền cọc -> Ném lỗi RETURN_ALREADY_REFUNDED")
    void scenario15_DuplicateRefund_ThrowsException() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .approvalStatus("APPROVED")
                .refundStatus("REFUNDED")
                .refundTxnRef("TXN-REFUND-999")
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        HandoverRequest req = HandoverRequest.builder()
                .refundMethod("BANK_TRANSFER")
                .build();

        AppException ex = assertThrows(AppException.class, () -> handoverService.executeRefund(bookingId, req));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_ALREADY_REFUNDED);
    }

    // =========================================================================
    // 16. Kho còn đồ đạc
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 16: Kho còn đồ đạc -> Cấm nhận lại kho vật lý, ném RETURN_ASSETS_NOT_CLEARED")
    void scenario16_AssetsNotCleared_CannotConfirmPhysicalReturn() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .assetsClearedPassed(false) // Còn đồ đạc
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        AppException ex = assertThrows(AppException.class, () -> handoverService.confirmPhysicalReturn(bookingId, HandoverRequest.builder().build()));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_ASSETS_NOT_CLEARED);
    }

    // =========================================================================
    // 17. Kho cần bảo trì sau nghiệm thu
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 17: Kho hư hại hoặc cảm biến báo lỗi -> Chuyển sang UNDER_MAINTENANCE thay vì AVAILABLE")
    void scenario17_DamagedUnit_MovesToUnderMaintenanceUponCompletion() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .inspectionStatus("COMPLETED")
                .assetsClearedPassed(true)
                .wallStructurePassed(false) // Hư hỏng vách ngăn
                .approvalStatus("APPROVED")
                .approvedDeductions(new BigDecimal("500000.00"))
                .deductionAmount(new BigDecimal("500000.00"))
                .unitReturnedPhysically(true)
                .accessRevoked(true)
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));
        when(rentalContractRepository.findByBookingId(bookingId)).thenReturn(Optional.of(testContract));

        handoverService.completeReturn(bookingId);

        // Buồng kho phải chuyển sang UNDER_MAINTENANCE!
        assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.UNDER_MAINTENANCE);
        assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.COMPLETED);
        assertThat(testContract.getStatus()).isEqualTo(RentalContractStatus.TERMINATED);
    }

    // =========================================================================
    // 18. Chưa nhận lại kho vật lý mà cố hoàn tất
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 18: Chưa xác nhận nhận lại kho vật lý -> Ném RETURN_PHYSICAL_HANDOVER_REQUIRED")
    void scenario18_PhysicalHandoverNotConfirmed_CannotComplete() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .inspectionStatus("COMPLETED")
                .assetsClearedPassed(true)
                .approvalStatus("APPROVED")
                .unitReturnedPhysically(false) // Chưa nhận lại kho
                .accessRevoked(true)
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        AppException ex = assertThrows(AppException.class, () -> handoverService.completeReturn(bookingId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_PHYSICAL_HANDOVER_REQUIRED);
    }

    // =========================================================================
    // 19. Chưa thu hồi quyền truy cập SmartLock mà cố hoàn tất
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 19: Chưa thu hồi SmartLock -> Ném RETURN_ACCESS_REVOCATION_FAILED")
    void scenario19_AccessNotRevoked_CannotComplete() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .inspectionStatus("COMPLETED")
                .assetsClearedPassed(true)
                .approvalStatus("APPROVED")
                .unitReturnedPhysically(true)
                .accessRevoked(false) // Chưa thu hồi SmartLock
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        AppException ex = assertThrows(AppException.class, () -> handoverService.completeReturn(bookingId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_ACCESS_REVOCATION_FAILED);
    }

    // =========================================================================
    // 20. Hồ sơ chưa nghiệm thu mà cố hoàn tất
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 20: Hồ sơ chưa nghiệm thu -> Ném RETURN_NOT_INSPECTED")
    void scenario20_NotInspected_CannotComplete() {
        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(Collections.emptyList());

        AppException ex = assertThrows(AppException.class, () -> handoverService.completeReturn(bookingId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_NOT_INSPECTED);
    }

    // =========================================================================
    // 21. Hồ sơ đã hoàn tất nhưng người dùng cố thao tác tiếp
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 21: Hồ sơ đã COMPLETED nhưng người dùng cố thao tác tiếp -> Ném RETURN_ALREADY_COMPLETED")
    void scenario21_AlreadyCompleted_ThrowsException() {
        testBooking.setStatus(BookingStatus.COMPLETED); // Đã xong

        AppException ex = assertThrows(AppException.class, () -> handoverService.completeReturn(bookingId));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RETURN_ALREADY_COMPLETED);
    }

    // =========================================================================
    // 22. Thu hồi mã SmartLock thành công
    // =========================================================================
    @Test
    @DisplayName("Kịch bản 22: Thu hồi SmartLock thành công -> Đánh dấu accessRevoked = true và giải phóng mã PIN")
    void scenario22_RevokeAccess_Succeeds() {
        HandoverRecord record = HandoverRecord.builder()
                .booking(testBooking)
                .recordType("RETURN")
                .accessRevoked(false)
                .build();

        when(handoverRecordRepository.findByBooking_IdOrderByRecordedAtDesc(bookingId)).thenReturn(List.of(record));

        HandoverResponse response = handoverService.revokeAccess(bookingId);

        assertThat(response.getAccessRevoked()).isTrue();
        assertThat(record.getAccessRevoked()).isTrue();
        assertThat(record.getAccessRevokedAt()).isNotNull();
        verify(storageUnitLockService, times(1)).releaseLock(testUnit.getId());
    }
}
