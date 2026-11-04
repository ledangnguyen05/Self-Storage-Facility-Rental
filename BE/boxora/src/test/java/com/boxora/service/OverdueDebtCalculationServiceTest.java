package com.boxora.service;

import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.RentalContract;
import com.boxora.enums.OverdueStage;
import com.boxora.enums.PinRevocationExecutionStatus;
import com.boxora.integration.smartlock.SmartLockAdapter;
import com.boxora.integration.smartlock.impl.SmartLockMockAdapterImpl;
import com.boxora.repository.PaymentRepository;
import com.boxora.service.impl.OverdueDebtCalculationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OverdueDebtCalculationServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @InjectMocks
    private OverdueDebtCalculationServiceImpl calculationService;

    private FacilityPolicy standardPolicy;
    private final LocalDate refDate = LocalDate.of(2026, 11, 10);

    @BeforeEach
    void setUp() {
        standardPolicy = FacilityPolicy.builder()
                .isActive(true)
                .overdueGraceDays(1)
                .dailyLateFee(new BigDecimal("100.00"))
                .overdueAccessDisableDays(3)
                .overdueSealingDays(7)
                .build();
    }

    @Test
    @DisplayName("Day 0: Due date is today -> 0 days overdue, 0 fee, 0 total debt")
    void testDayZeroNotOverdue() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-00")
                .monthlyFee(new BigDecimal("1500000.00"))
                .endDate(refDate)
                .build();
        contract.setId(UUID.randomUUID());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(0, result.overdueDays());
        assertEquals(0, result.lateFee().compareTo(BigDecimal.ZERO));
        assertEquals(0, result.totalDebt().compareTo(BigDecimal.ZERO));
        assertEquals(OverdueStage.GRACE_PERIOD, result.stage());
    }

    @Test
    @DisplayName("Day 1: Grace period (Nhóm 1) -> overdueDays = 1, lateFee = 0, totalDebt = 0")
    void testDayOneGracePeriod() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-01")
                .monthlyFee(new BigDecimal("1500000.00"))
                .endDate(refDate.minusDays(1))
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(1, result.overdueDays());
        assertEquals(0, result.lateFee().compareTo(BigDecimal.ZERO));
        assertEquals(0, result.totalDebt().compareTo(BigDecimal.ZERO));
        assertEquals(OverdueStage.GRACE_PERIOD, result.stage());
    }

    @Test
    @DisplayName("Day 2: Warning stage (Nhóm 2) -> overdueDays = 2, lateFee = 50,000 (100% of 1,500,000 / 30)")
    void testDayTwoWarning() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-02")
                .monthlyFee(new BigDecimal("1500000.00"))
                .endDate(refDate.minusDays(2))
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(2, result.overdueDays());
        assertEquals(0, result.lateFee().compareTo(new BigDecimal("50000")));
        assertEquals(0, result.totalDebt().compareTo(new BigDecimal("50000")));
        assertEquals(OverdueStage.WARNING, result.stage());
    }

    @Test
    @DisplayName("Day 3: PIN Revocation threshold (Nhóm 3) -> overdueDays = 3, lateFee = 100,000")
    void testDayThreePinThreshold() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-03")
                .monthlyFee(new BigDecimal("1500000.00"))
                .endDate(refDate.minusDays(3))
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(3, result.overdueDays());
        assertEquals(0, result.lateFee().compareTo(new BigDecimal("100000")));
        assertEquals(0, result.totalDebt().compareTo(new BigDecimal("100000")));
        assertEquals(OverdueStage.PIN_REVOCATION, result.stage());
    }

    @Test
    @DisplayName("Day 6: PIN Revocation upper bound (Nhóm 3) -> overdueDays = 6, lateFee = 500,000 (3,000,000 / 30 * 5d)")
    void testDaySixPinThreshold() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-06")
                .monthlyFee(new BigDecimal("3000000.00"))
                .endDate(refDate.minusDays(6))
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(6, result.overdueDays());
        assertEquals(0, result.lateFee().compareTo(new BigDecimal("500000")));
        assertEquals(0, result.totalDebt().compareTo(new BigDecimal("500000")));
        assertEquals(OverdueStage.PIN_REVOCATION, result.stage());
    }

    @Test
    @DisplayName("Day 7: Sealing eligible (Nhóm 4) -> overdueDays = 7, lateFee = 300,000")
    void testDaySevenSealingEligible() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-07")
                .monthlyFee(new BigDecimal("1500000.00"))
                .endDate(refDate.minusDays(7))
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(7, result.overdueDays());
        assertEquals(0, result.lateFee().compareTo(new BigDecimal("300000")));
        assertEquals(0, result.totalDebt().compareTo(new BigDecimal("300000")));
        assertEquals(OverdueStage.SEALING_ELIGIBLE, result.stage());
    }

    @Test
    @DisplayName("Day 15: Deep overdue sealing (Nhóm 4) -> overdueDays = 15, lateFee = 1,400,000")
    void testDayFifteenSealing() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-15")
                .monthlyFee(new BigDecimal("3000000.00"))
                .endDate(refDate.minusDays(15))
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(15, result.overdueDays());
        assertEquals(0, result.lateFee().compareTo(new BigDecimal("1400000")));
        assertEquals(0, result.totalDebt().compareTo(new BigDecimal("1400000")));
        assertEquals(OverdueStage.SEALING_ELIGIBLE, result.stage());
    }

    @Test
    @DisplayName("User Example: Kho mini 450k/tháng -> 15k/ngày (100% -> 15k/ngày, 120% -> 18k/ngày)")
    void testUserExampleKhoMiniPercentageFormula() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-MINI")
                .monthlyFee(new BigDecimal("450000.00"))
                .endDate(refDate.minusDays(2)) // 2 days overdue - 1 grace = 1 day billable
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        // Case 1: 100% fee -> 15,000 / day
        FacilityPolicy policy100 = FacilityPolicy.builder()
                .isActive(true)
                .overdueGraceDays(1)
                .dailyLateFee(new BigDecimal("100.00"))
                .overdueAccessDisableDays(3)
                .overdueSealingDays(7)
                .build();

        var result100 = calculationService.calculateOverdueDebt(contract, policy100, refDate);
        assertEquals(0, result100.dailyLateFee().compareTo(new BigDecimal("15000")));
        assertEquals(0, result100.lateFee().compareTo(new BigDecimal("15000")));
        assertEquals(0, result100.totalDebt().compareTo(new BigDecimal("15000")));

        // Case 2: 120% fee -> 18,000 / day
        FacilityPolicy policy120 = FacilityPolicy.builder()
                .isActive(true)
                .overdueGraceDays(1)
                .dailyLateFee(new BigDecimal("120.00"))
                .overdueAccessDisableDays(3)
                .overdueSealingDays(7)
                .build();

        var result120 = calculationService.calculateOverdueDebt(contract, policy120, refDate);
        assertEquals(0, result120.dailyLateFee().compareTo(new BigDecimal("18000")));
        assertEquals(0, result120.lateFee().compareTo(new BigDecimal("18000")));
        assertEquals(0, result120.totalDebt().compareTo(new BigDecimal("18000")));
    }

    @Test
    @DisplayName("User Case: Kho lạnh 3.100.000 đ/tháng, cọc 3.100.000 đ, quá hạn 2 ngày -> Làm tròn lên 104.000 đ/ngày, Số tiền hoàn khách = 2.996.000 đ, Tổng nợ = 0")
    void testUserCaseKhoLanhLateCheckoutRefund() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-Q2-EXPTODAY-05")
                .monthlyFee(new BigDecimal("3100000.00"))
                .depositHeld(new BigDecimal("3100000.00"))
                .endDate(refDate.minusDays(2)) // 2 days overdue - 1 grace = 1 day billable
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        // Daily rate: 3,100,000 / 30 = 103,333.33 -> rounded up to thousands: 104,000 đ/ngày
        assertEquals(0, result.dailyLateFee().compareTo(new BigDecimal("104000")));
        assertEquals(0, result.lateFee().compareTo(new BigDecimal("104000")));
        // Customer refund amount = 3,100,000 - 104,000 = 2,996,000 đ
        assertEquals(0, result.customerRefundAmount().compareTo(new BigDecimal("2996000")));
        // Deposit covers late fee, so totalDebt = 0
        assertEquals(0, result.totalDebt().compareTo(BigDecimal.ZERO));
    }

    @Test
    @DisplayName("User Example: Tiêu chuẩn (căn một phòng ngủ) 3.500.000 đ/tháng -> làm tròn lên tiền chẵn 117.000 đ/ngày")
    void testUserExampleTieuChuanCanMotPhongNguRoundingUp() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-TIEU-CHUAN-01")
                .monthlyFee(new BigDecimal("3500000.00"))
                .depositHeld(new BigDecimal("3500000.00"))
                .endDate(refDate.minusDays(2)) // 2 days overdue - 1 grace = 1 day billable
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        // Daily rate: 3,500,000 / 30 = 116,666.666... -> rounded up to thousands: 117,000 đ/ngày
        assertEquals(0, result.dailyRentalPrice().compareTo(new BigDecimal("117000")));
        assertEquals(0, result.dailyLateFee().compareTo(new BigDecimal("117000")));
        assertEquals(0, result.lateFee().compareTo(new BigDecimal("117000")));
        // Customer refund amount = 3,500,000 - 117,000 = 3,383,000 đ
        assertEquals(0, result.customerRefundAmount().compareTo(new BigDecimal("3383000")));
        assertEquals(0, result.totalDebt().compareTo(BigDecimal.ZERO));
    }

    @Test
    @DisplayName("Group 5: Missing or invalid policy -> Classified as POLICY_UNCONFIGURED with zero lateFee")
    void testMissingOrInvalidPolicy() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-E")
                .monthlyFee(new BigDecimal("1500000.00"))
                .endDate(refDate.minusDays(5))
                .build();
        contract.setId(UUID.randomUUID());

        // Null policy
        var resultNull = calculationService.calculateOverdueDebt(contract, null, refDate);
        assertFalse(resultNull.isPolicyValid());
        assertEquals(OverdueStage.POLICY_UNCONFIGURED, resultNull.stage());
        assertEquals(0, resultNull.lateFee().compareTo(BigDecimal.ZERO));

        // Inactive policy
        FacilityPolicy inactivePolicy = FacilityPolicy.builder().isActive(false).build();
        var resultInactive = calculationService.calculateOverdueDebt(contract, inactivePolicy, refDate);
        assertFalse(resultInactive.isPolicyValid());
        assertEquals(OverdueStage.POLICY_UNCONFIGURED, resultInactive.stage());

        // Inverted thresholds (sealingDays < accessDisableDays)
        FacilityPolicy invalidPolicy = FacilityPolicy.builder()
                .isActive(true)
                .overdueGraceDays(1)
                .dailyLateFee(new BigDecimal("200000.00"))
                .overdueAccessDisableDays(7)
                .overdueSealingDays(3) // Invalid: sealing before disable
                .build();
        var resultInvalid = calculationService.calculateOverdueDebt(contract, invalidPolicy, refDate);
        assertFalse(resultInvalid.isPolicyValid());
        assertEquals(OverdueStage.POLICY_UNCONFIGURED, resultInvalid.stage());
    }

    @Test
    @DisplayName("SmartLock Mock Adapter: distinguishes ONLINE success vs OFFLINE failure with MOCK indicator")
    void testSmartLockMockAdapter() {
        SmartLockAdapter adapter = new SmartLockMockAdapterImpl();
        assertTrue(adapter.isMock());

        // Online revocation
        var onlineResult = adapter.revokeCredentials("TB-A101", "ONLINE", false);
        assertTrue(onlineResult.success());
        assertTrue(onlineResult.isMock());
        assertEquals(PinRevocationExecutionStatus.SUCCESS_MOCK, onlineResult.status());

        // Offline revocation failure
        var offlineResult = adapter.revokeCredentials("TB-A102", "OFFLINE", false);
        assertFalse(offlineResult.success());
        assertTrue(offlineResult.isMock());
        assertEquals(PinRevocationExecutionStatus.FAILED_OFFLINE, offlineResult.status());
        assertNotNull(offlineResult.errorDetails());
    }
}
