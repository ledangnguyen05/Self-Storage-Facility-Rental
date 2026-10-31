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
                .dailyLateFee(new BigDecimal("200000.00"))
                .overdueAccessDisableDays(3)
                .overdueSealingDays(7)
                .build();
    }

    @Test
    @DisplayName("Day 0: Due date is today -> 0 days overdue, 0 fee")
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
        assertEquals(0, result.totalDebt().compareTo(new BigDecimal("1500000.00")));
        assertEquals(OverdueStage.GRACE_PERIOD, result.stage());
    }

    @Test
    @DisplayName("Day 1: Grace period (Nhóm 1) -> overdueDays = 1, lateFee = 0")
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
        assertEquals(0, result.totalDebt().compareTo(new BigDecimal("1500000.00")));
        assertEquals(OverdueStage.GRACE_PERIOD, result.stage());
    }

    @Test
    @DisplayName("Day 2: Warning stage (Nhóm 2) -> overdueDays = 2, lateFee = 200,000")
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
        assertEquals(new BigDecimal("200000.00"), result.lateFee());
        assertEquals(new BigDecimal("1700000.00"), result.totalDebt());
        assertEquals(OverdueStage.WARNING, result.stage());
    }

    @Test
    @DisplayName("Day 3: PIN Revocation threshold (Nhóm 3) -> overdueDays = 3, lateFee = 400,000")
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
        assertEquals(new BigDecimal("400000.00"), result.lateFee());
        assertEquals(new BigDecimal("1900000.00"), result.totalDebt());
        assertEquals(OverdueStage.PIN_REVOCATION, result.stage());
    }

    @Test
    @DisplayName("Day 6: PIN Revocation upper bound (Nhóm 3) -> overdueDays = 6, lateFee = 1,000,000")
    void testDaySixPinThreshold() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-06")
                .monthlyFee(new BigDecimal("2000000.00"))
                .endDate(refDate.minusDays(6))
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(6, result.overdueDays());
        assertEquals(new BigDecimal("1000000.00"), result.lateFee());
        assertEquals(new BigDecimal("3000000.00"), result.totalDebt());
        assertEquals(OverdueStage.PIN_REVOCATION, result.stage());
    }

    @Test
    @DisplayName("Day 7: Sealing eligible (Nhóm 4) -> overdueDays = 7, lateFee = 1,200,000")
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
        assertEquals(new BigDecimal("1200000.00"), result.lateFee());
        assertEquals(new BigDecimal("2700000.00"), result.totalDebt());
        assertEquals(OverdueStage.SEALING_ELIGIBLE, result.stage());
    }

    @Test
    @DisplayName("Day 15: Deep overdue sealing (Nhóm 4) -> overdueDays = 15, lateFee = 2,800,000")
    void testDayFifteenSealing() {
        RentalContract contract = RentalContract.builder()
                .contractCode("CTR-15")
                .monthlyFee(new BigDecimal("2000000.00"))
                .endDate(refDate.minusDays(15))
                .build();
        contract.setId(UUID.randomUUID());

        when(paymentRepository.findByContract_Id(any())).thenReturn(Collections.emptyList());

        var result = calculationService.calculateOverdueDebt(contract, standardPolicy, refDate);

        assertEquals(15, result.overdueDays());
        assertEquals(new BigDecimal("2800000.00"), result.lateFee());
        assertEquals(new BigDecimal("4800000.00"), result.totalDebt());
        assertEquals(OverdueStage.SEALING_ELIGIBLE, result.stage());
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
