package com.boxora.service;

import com.boxora.dto.request.OverdueSettlementRequest;
import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.response.FacilityRevenueResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.dto.response.SystemRevenueSummaryResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.integration.smartlock.SmartLockAdapter;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.OverdueDebtCalculationServiceImpl;
import com.boxora.service.impl.OverdueManagementServiceImpl;
import com.boxora.service.impl.ReportServiceImpl;
import com.boxora.service.impl.StorageUnitServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class FinalSafetyAuditRegressionTest {

    // OverdueManagement mocks
    @Mock private RentalContractRepository rentalContractRepository;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private SealingRecordRepository sealingRecordRepository;
    @Mock private UserRepository userRepository;
    @Mock private PaymentRepository paymentRepository;
    @Mock private HandoverRecordRepository handoverRecordRepository;
    @Mock private OverdueNoticeLogRepository overdueNoticeLogRepository;
    @Mock private PinRevocationRequestRepository pinRevocationRequestRepository;
    @Mock private AssetInventoryItemRepository assetInventoryItemRepository;
    @Mock private OverdueAuditLogRepository overdueAuditLogRepository;
    @Mock private OverdueDebtCalculationService overdueDebtCalculationService;
    @Mock private SmartLockAdapter smartLockAdapter;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private RequestContext requestContext;
    @Mock private EmailService emailService;
    @Mock private ActivityLogService activityLogService;
    @Mock private NotificationLogRepository notificationLogRepository;

    @InjectMocks
    private OverdueManagementServiceImpl overdueManagementService;

    // ReportService mocks & instance
    @Mock private FacilityRepository facilityRepository;
    @Mock private RefundRequestRepository refundRequestRepository;
    @InjectMocks
    private ReportServiceImpl reportService;

    // StorageUnit mocks & instance
    @Mock private UnitTypeRepository unitTypeRepository;
    @Mock private StorageUnitPriceHistoryService storageUnitPriceHistoryService;
    @InjectMocks
    private StorageUnitServiceImpl storageUnitService;

    private Facility facilityA;
    private Facility facilityB;
    private FacilityPolicy policyA;
    private StorageUnit unitA;
    private User customer;
    private User staff;
    private RentalContract contract;
    private Booking booking;

    @BeforeEach
    void setUp() {
        facilityA = Facility.builder().name("Boxora Facility A").build();
        facilityA.setId(UUID.randomUUID());

        facilityB = Facility.builder().name("Boxora Facility B").build();
        facilityB.setId(UUID.randomUUID());

        policyA = FacilityPolicy.builder()
                .facility(facilityA)
                .isActive(true)
                .overdueGraceDays(1)
                .dailyLateFee(new BigDecimal("50000"))
                .overdueAccessDisableDays(3)
                .overdueSealingDays(7)
                .build();

        unitA = StorageUnit.builder()
                .unitCode("TB-A101")
                .floorLevel("1")
                .status(UnitStatus.OCCUPIED)
                .facility(facilityA)
                .pricePerMonth(new BigDecimal("1000000"))
                .build();
        unitA.setId(UUID.randomUUID());

        customer = User.builder().fullName("Nguyen Van A").email("nguyenvana@example.com").phone("0901234567").build();
        customer.setId(UUID.randomUUID());

        staff = User.builder().fullName("Staff Tran").email("staff@boxora.com").build();
        staff.setId(UUID.randomUUID());

        booking = Booking.builder()
                .bookingCode("BK-1001")
                .customer(customer)
                .storageUnit(unitA)
                .facility(facilityA)
                .startDate(LocalDate.now().minusDays(40))
                .endDate(LocalDate.now().minusDays(10))
                .status(BookingStatus.ACTIVE)
                .paymentStatus("PAID")
                .depositPaid(new BigDecimal("1000000"))
                .build();
        booking.setId(UUID.randomUUID());

        contract = RentalContract.builder()
                .contractCode("CTR-1001")
                .customer(customer)
                .unit(unitA)
                .facility(facilityA)
                .booking(booking)
                .startDate(LocalDate.now().minusDays(40))
                .endDate(LocalDate.now().minusDays(10))
                .monthlyFee(new BigDecimal("1000000"))
                .status(RentalContractStatus.OVERDUE)
                .overduePinStatus(OverduePinStatus.PIN_ACTIVE)
                .build();
        contract.setId(UUID.randomUUID());

        var auth = new UsernamePasswordAuthenticationToken(staff.getEmail(), null,
                List.of(new SimpleGrantedAuthority("ROLE_STAFF"), new SimpleGrantedAuthority("OVERDUE_PROCESS")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    // -------------------------------------------------------------------------
    // Scenario 1: Bấm "Đã xong" khi chưa có xác minh thanh toán → không tạo Payment PAID
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("1. Bấm 'Đã xong' khi chưa có xác minh thanh toán → ném lỗi và KHÔNG tạo Payment PAID khống")
    void test1_ClickDaXongWithoutPaymentVerification_DoesNotCreatePaymentPaid() {
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityA.getId())).thenReturn(Optional.of(policyA));

        // Overdue debt is 1,450,000 VND
        var calcResult = new OverdueDebtCalculationService.CalculationResult(
                10L, new BigDecimal("1000000"), new BigDecimal("50000"), new BigDecimal("450000"),
                new BigDecimal("1450000"), BigDecimal.ZERO, OverdueStage.PIN_REVOCATION, true, null,
                contract.getEndDate(), LocalDate.now(), "Test calculation"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any())).thenReturn(calcResult);

        // Staff clicks "Đã xong" without providing counter payment voucher or payment proof
        AppException ex = assertThrows(AppException.class, () ->
                overdueManagementService.completeSettlement(contract.getId())
        );

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
        assertThat(ex.getMessage()).contains("chưa được thanh toán hoặc xác nhận");

        // Verify NO Payment record is saved to the database!
        verify(paymentRepository, never()).save(any(Payment.class));
        // Verify contract was NOT terminated prematurely
        assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE);
    }

    // -------------------------------------------------------------------------
    // Scenario 2: Đã thanh toán hợp lệ → không thu trùng
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("2. Đã thanh toán nợ đầy đủ hợp lệ trước đó → tất toán không tạo Payment thứ hai thu trùng")
    void test2_AlreadyPaidValidly_DoesNotDuplicatePayment() {
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityA.getId())).thenReturn(Optional.of(policyA));

        // Overdue debt has already been paid off: remainingDebt = 0
        var calcResult = new OverdueDebtCalculationService.CalculationResult(
                10L, BigDecimal.ZERO, new BigDecimal("50000"), BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, OverdueStage.PIN_REVOCATION, true, null,
                contract.getEndDate(), LocalDate.now(), "Already fully paid"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any())).thenReturn(calcResult);
        when(sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contract.getId())).thenReturn(Optional.empty());

        // Call completeSettlement
        overdueManagementService.completeSettlement(contract.getId());

        // Verify NO duplicate Payment was created!
        verify(paymentRepository, never()).save(any(Payment.class));
        // Contract successfully terminated
        assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.TERMINATED);
    }

    // -------------------------------------------------------------------------
    // Scenario 3: Thanh toán nợ một phần → không tất toán hết
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("3. Thanh toán nợ một phần (còn dư nợ) → không cho phép tất toán kết thúc hợp đồng")
    void test3_PartialPayment_DoesNotFullySettle() {
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityA.getId())).thenReturn(Optional.of(policyA));

        // Total was 1,450,000; customer partially paid 500,000 -> remaining is 950,000
        var calcResult = new OverdueDebtCalculationService.CalculationResult(
                10L, new BigDecimal("500000"), new BigDecimal("50000"), new BigDecimal("450000"),
                new BigDecimal("950000"), BigDecimal.ZERO, OverdueStage.PIN_REVOCATION, true, null,
                contract.getEndDate(), LocalDate.now(), "Partially paid"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any())).thenReturn(calcResult);

        // Manager tries to complete settlement with only 500,000 (less than remaining 950,000)
        OverdueSettlementRequest partialReq = OverdueSettlementRequest.builder()
                .receiptVoucherCode("PT-PARTIAL-001")
                .amount(new BigDecimal("500000"))
                .paymentMethod("CASH")
                .build();

        AppException ex = assertThrows(AppException.class, () ->
                overdueManagementService.completeSettlement(contract.getId(), partialReq)
        );

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
        assertThat(ex.getMessage()).contains("nhỏ hơn số dư nợ quá hạn");
        // Verify contract was NOT terminated
        assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE);
    }

    // -------------------------------------------------------------------------
    // Scenario 4: Đã trả đủ nợ nhưng chưa bàn giao → kho không AVAILABLE
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("4. Đã trả đủ nợ nhưng chưa có biên bản bàn giao nghiệm thu trả kho → buồng kho KHÔNG chuyển AVAILABLE")
    void test4_PaidDebtButNoPhysicalHandover_UnitDoesNotBecomeAvailable() {
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityA.getId())).thenReturn(Optional.of(policyA));

        // Remaining debt = 0
        var calcResult = new OverdueDebtCalculationService.CalculationResult(
                10L, BigDecimal.ZERO, new BigDecimal("50000"), BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, OverdueStage.PIN_REVOCATION, true, null,
                contract.getEndDate(), LocalDate.now(), "Debt settled"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any())).thenReturn(calcResult);
        when(sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contract.getId())).thenReturn(Optional.empty());

        // NO physical return handover record exists!
        when(handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "RETURN"))
                .thenReturn(Optional.empty());
        when(handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "INSPECTION"))
                .thenReturn(Optional.empty());

        // Mock smart lock revocation
        when(smartLockAdapter.revokeCredentials(any(), any(), eq(false)))
                .thenReturn(new SmartLockAdapter.RevocationResult(PinRevocationExecutionStatus.SUCCESS_MOCK, true, true, "OK", null));

        // Initial unit status is OCCUPIED
        assertThat(unitA.getStatus()).isEqualTo(UnitStatus.OCCUPIED);

        // Execute settlement
        overdueManagementService.completeSettlement(contract.getId());

        // Unit must NOT become AVAILABLE!
        assertThat(unitA.getStatus()).isNotEqualTo(UnitStatus.AVAILABLE);
        assertThat(unitA.getStatus()).isEqualTo(UnitStatus.OCCUPIED);
    }

    // -------------------------------------------------------------------------
    // Scenario 5: Đã bàn giao nhưng PIN chưa thu hồi thành công → không giải phóng kho
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("5. Đã bàn giao nhưng SmartLock IoT thu hồi PIN thất bại → KHÔNG giải phóng kho thành AVAILABLE")
    void test5_HandoverCompletedButPinRevocationFailed_UnitDoesNotBecomeAvailable() {
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityA.getId())).thenReturn(Optional.of(policyA));

        var calcResult = new OverdueDebtCalculationService.CalculationResult(
                10L, BigDecimal.ZERO, new BigDecimal("50000"), BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, OverdueStage.PIN_REVOCATION, true, null,
                contract.getEndDate(), LocalDate.now(), "Debt settled"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any())).thenReturn(calcResult);
        when(sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contract.getId())).thenReturn(Optional.empty());

        // Return record exists and passed
        HandoverRecord returnRecord = HandoverRecord.builder()
                .booking(booking)
                .recordType("RETURN")
                .doorConditionPassed(true)
                .cleanlinessPassed(true)
                .smartLockPassed(true)
                .sensorPassed(true)
                .wallStructurePassed(true)
                .deductionAmount(BigDecimal.ZERO)
                .build();
        when(handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "RETURN"))
                .thenReturn(Optional.of(returnRecord));

        // BUT SmartLock IoT revocation FAILED (e.g. gateway offline or device error)
        when(smartLockAdapter.revokeCredentials(any(), any(), eq(false)))
                .thenReturn(new SmartLockAdapter.RevocationResult(PinRevocationExecutionStatus.FAILED_OFFLINE, false, false, "Gateway unreachable", "TIMEOUT"));

        // Execute settlement
        overdueManagementService.completeSettlement(contract.getId());

        // Unit must NOT be released to AVAILABLE!
        assertThat(unitA.getStatus()).isNotEqualTo(UnitStatus.AVAILABLE);
    }

    // -------------------------------------------------------------------------
    // Scenario 6: Đã hoàn thành đầy đủ → Customer hiển thị "Đã ngưng thuê"
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("6. Đã hoàn thành đầy đủ các bước → RentalContract là TERMINATED và Booking là COMPLETED")
    void test6_AllConditionsMet_CustomerStatusDisplaysTerminatedDaNgungThue() {
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityA.getId())).thenReturn(Optional.of(policyA));

        var calcResult = new OverdueDebtCalculationService.CalculationResult(
                10L, BigDecimal.ZERO, new BigDecimal("50000"), BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, OverdueStage.PIN_REVOCATION, true, null,
                contract.getEndDate(), LocalDate.now(), "Debt settled"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any())).thenReturn(calcResult);
        when(sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contract.getId())).thenReturn(Optional.empty());

        // Inspection passed cleanly
        HandoverRecord returnRecord = HandoverRecord.builder()
                .booking(booking)
                .recordType("RETURN")
                .doorConditionPassed(true)
                .cleanlinessPassed(true)
                .smartLockPassed(true)
                .sensorPassed(true)
                .wallStructurePassed(true)
                .deductionAmount(BigDecimal.ZERO)
                .build();
        when(handoverRecordRepository.findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(booking.getId(), "RETURN"))
                .thenReturn(Optional.of(returnRecord));

        // SmartLock revoked successfully
        when(smartLockAdapter.revokeCredentials(any(), any(), eq(false)))
                .thenReturn(new SmartLockAdapter.RevocationResult(PinRevocationExecutionStatus.SUCCESS_MOCK, true, true, "Revoked", null));

        // Execute settlement
        overdueManagementService.completeSettlement(contract.getId());

        // Assertions:
        assertThat(contract.getStatus()).isEqualTo(RentalContractStatus.TERMINATED);
        assertThat(booking.getStatus()).isEqualTo(BookingStatus.COMPLETED);
        assertThat(unitA.getStatus()).isEqualTo(UnitStatus.AVAILABLE);
    }

    // -------------------------------------------------------------------------
    // Scenario 7: Công nợ nhiều kỳ → tính và báo cáo đúng số dư
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("7. Công nợ nhiều kỳ (> 30 ngày) và thanh toán một phần → tính chính xác nợ gốc nhiều chu kỳ")
    void test7_MultiPeriodOverdueDebt_ReportsAccurateBalance() {
        OverdueDebtCalculationServiceImpl calcImpl = new OverdueDebtCalculationServiceImpl(paymentRepository);

        LocalDate dueDate = LocalDate.of(2026, 8, 1);
        LocalDate refDate = LocalDate.of(2026, 9, 15); // 45 days overdue -> 2 cycles (30 days + 15 days)

        RentalContract multiContract = RentalContract.builder()
                .contractCode("CTR-MULTI-01")
                .monthlyFee(new BigDecimal("1000000"))
                .endDate(dueDate)
                .build();
        multiContract.setId(UUID.randomUUID());

        // No payments yet
        when(paymentRepository.findByContract_Id(multiContract.getId())).thenReturn(Collections.emptyList());

        var result = calcImpl.calculateOverdueDebt(multiContract, policyA, refDate);

        // 45 days overdue:
        assertThat(result.overdueDays()).isEqualTo(45L);
        // Late fee: billable days = 45 - 1 = 44 days * 33,333 đ/ngày = 1,466,652 VND
        assertThat(result.lateFee()).isEqualByComparingTo("1466652");
        assertThat(result.totalDebt()).isEqualByComparingTo("1466652");

        // Now test partial payment: customer paid 500,000 VND
        Payment paidPart = Payment.builder()
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("500000"))
                .build();
        when(paymentRepository.findByContract_Id(multiContract.getId())).thenReturn(List.of(paidPart));

        var resultAfterPartial = calcImpl.calculateOverdueDebt(multiContract, policyA, refDate);
        // Late fee reduced after partial payment: 1,466,652 - 500,000 = 966,652
        assertThat(resultAfterPartial.totalDebt()).isEqualByComparingTo("966652");
        assertThat(resultAfterPartial.lateFee()).isEqualByComparingTo("966652");
    }

    // -------------------------------------------------------------------------
    // Scenario 8: Báo cáo không cộng tiền cọc vào doanh thu thuần
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("8. Báo cáo doanh thu: Tiền cọc (DEPOSIT) chỉ cộng vào Total Cash-In, KHÔNG cộng vào Net Revenue")
    void test8_RevenueReport_DoesNotAddDepositIntoNetRevenue() {
        when(facilityAccessGuard.isFacilityScoped()).thenReturn(false);

        // Mock facility revenue from paymentRepository:
        // RentalFee: 10,000,000 | Deposit: 5,000,000 | Renewal: 2,000,000 | ExtraCharge: 500,000 | BookingPayment: 0
        FacilityRevenueResponse facRev = new FacilityRevenueResponse(
                facilityA.getId(),
                facilityA.getName(),
                new BigDecimal("12500000"), // total without deposit
                new BigDecimal("5000000"),  // deposit
                new BigDecimal("10000000"), // rental
                new BigDecimal("2000000"),  // renewal
                new BigDecimal("500000"),   // extra charge
                BigDecimal.ZERO,            // booking payment
                5L                          // count
        );
        when(paymentRepository.sumRevenueByFacility(any(), any(), any())).thenReturn(List.of(facRev));

        SystemRevenueSummaryResponse sysSummary = SystemRevenueSummaryResponse.builder()
                .rentalFeeRevenue(new BigDecimal("10000000"))
                .renewalFeeRevenue(new BigDecimal("2000000"))
                .extraChargeRevenue(new BigDecimal("500000"))
                .depositRevenue(new BigDecimal("5000000"))
                .bookingPaymentRevenue(BigDecimal.ZERO)
                .totalRevenue(new BigDecimal("17500000"))
                .paymentCount(5L)
                .build();
        when(paymentRepository.sumSystemRevenue(any(), any(), any())).thenReturn(sysSummary);

        when(rentalContractRepository.findAll()).thenReturn(Collections.emptyList());
        when(refundRequestRepository.findAll()).thenReturn(Collections.emptyList());

        RevenueReportResponse report = reportService.getRevenueReport(LocalDate.now().minusMonths(1), LocalDate.now());

        // Net revenue = Rental (10m) + Renewal (2m) + Extra (500k) - Refunds (0) = 12,500,000 VND
        // It does NOT include 5,000,000 deposit!
        assertThat(report.getSystemSummary().getNetRevenue()).isEqualByComparingTo("12500000");

        // Total cash-in DOES include deposit (12.5m + 5m = 17,500,000 VND)
        assertThat(report.getSystemSummary().getTotalCashIn()).isEqualByComparingTo("17500000");
    }

    // -------------------------------------------------------------------------
    // Scenario 9: Thanh toán tại quầy đúng loại giao dịch và payment method
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("9. Thanh toán nợ quá hạn tại quầy: Ghi nhận chính xác paymentMethod, phiếu thu và loại RENTAL_FEE")
    void test9_CounterPayment_RecordsCorrectTransactionTypeAndMethod() {
        when(rentalContractRepository.findById(contract.getId())).thenReturn(Optional.of(contract));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityA.getId())).thenReturn(Optional.of(policyA));

        // Overdue debt is 1,450,000 VND
        var calcResult = new OverdueDebtCalculationService.CalculationResult(
                10L, new BigDecimal("1000000"), new BigDecimal("50000"), new BigDecimal("450000"),
                new BigDecimal("1450000"), BigDecimal.ZERO, OverdueStage.PIN_REVOCATION, true, null,
                contract.getEndDate(), LocalDate.now(), "Test calc"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any())).thenReturn(calcResult);
        when(sealingRecordRepository.findFirstByContract_IdOrderByCreatedAtDesc(contract.getId())).thenReturn(Optional.empty());

        when(requestContext.currentUserId()).thenReturn(staff.getId());
        when(userRepository.findById(staff.getId())).thenReturn(Optional.of(staff));
        when(paymentRepository.existsByReceiptVoucherCodeIgnoreCase("PT-2026-COUNTER-099")).thenReturn(false);

        // Staff provides valid counter payment request with BANK_TRANSFER and voucher code
        OverdueSettlementRequest settleReq = OverdueSettlementRequest.builder()
                .paymentMethod("BANK_TRANSFER")
                .receiptVoucherCode("PT-2026-COUNTER-099")
                .referenceCode("MB-TRANS-8899")
                .amount(new BigDecimal("1450000"))
                .notes("Khách hàng chuyển khoản tại quầy cơ sở")
                .build();

        overdueManagementService.completeSettlement(contract.getId(), settleReq);

        // Verify Payment was created with exact details
        verify(paymentRepository, times(1)).save(argThat(payment -> {
            assertThat(payment.getPaymentMethod()).isEqualTo("BANK_TRANSFER");
            assertThat(payment.getReceiptVoucherCode()).isEqualTo("PT-2026-COUNTER-099");
            assertThat(payment.getReferenceCode()).isEqualTo("MB-TRANS-8899");
            assertThat(payment.getPaymentType()).isEqualTo(PaymentType.RENTAL_FEE);
            assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PAID);
            assertThat(payment.getAmount()).isEqualByComparingTo("1450000");
            assertThat(payment.getCollectedByStaff()).isEqualTo(staff);
            assertThat(payment.getConfirmedByStaff()).isEqualTo(staff);
            return true;
        }));
    }

    // -------------------------------------------------------------------------
    // Scenario 10: Quyền tạo kho tuân thủ RBAC và facility scope
    // -------------------------------------------------------------------------
    @Test
    @DisplayName("10. Quyền tạo kho: FacilityAccessGuard kiểm soát chặt chẽ cơ sở, từ chối tạo kho chéo cơ sở")
    void test10_StorageUnitCreate_EnforcesRBACAndFacilityScope() {
        StorageUnitCreateRequest createRequestFacB = StorageUnitCreateRequest.builder()
                .facilityId(facilityB.getId())
                .unitTypeId(UUID.randomUUID())
                .unitCode("TB-B201")
                .floorLevel("2")
                .pricePerMonth(new BigDecimal("1200000"))
                .build();

        // FacilityAccessGuard detects cross-facility attempt and throws FACILITY_ACCESS_DENIED
        doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED))
                .when(facilityAccessGuard).checkFacilityAccess(facilityB.getId());

        AppException ex = assertThrows(AppException.class, () ->
                storageUnitService.createUnit(createRequestFacB)
        );

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FACILITY_ACCESS_DENIED);
        // Verify storageUnitRepository.save was NOT called!
        verify(storageUnitRepository, never()).save(any(StorageUnit.class));
    }
}
