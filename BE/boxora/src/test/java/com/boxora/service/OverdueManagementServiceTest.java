package com.boxora.service;

import com.boxora.dto.response.OverdueContractDetailResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.integration.smartlock.SmartLockAdapter;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.OverdueManagementServiceImpl;
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
class OverdueManagementServiceTest {

    @Mock
    private RentalContractRepository rentalContractRepository;
    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;
    @Mock
    private BookingRepository bookingRepository;
    @Mock
    private StorageUnitRepository storageUnitRepository;
    @Mock
    private SealingRecordRepository sealingRecordRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PaymentRepository paymentRepository;
    @Mock
    private OverdueNoticeLogRepository overdueNoticeLogRepository;
    @Mock
    private PinRevocationRequestRepository pinRevocationRequestRepository;
    @Mock
    private AssetInventoryItemRepository assetInventoryItemRepository;
    @Mock
    private OverdueAuditLogRepository overdueAuditLogRepository;
    @Mock
    private OverdueDebtCalculationService overdueDebtCalculationService;
    @Mock
    private SmartLockAdapter smartLockAdapter;
    @Mock
    private FacilityAccessGuard facilityAccessGuard;
    @Mock
    private RequestContext requestContext;
    @Mock
    private EmailService emailService;
    @Mock
    private ActivityLogService activityLogService;

    @InjectMocks
    private OverdueManagementServiceImpl overdueManagementService;

    private UUID contractId;
    private RentalContract testContract;
    private Facility testFacility;
    private StorageUnit testUnit;
    private User testCustomer;

    @BeforeEach
    void setUp() {
        contractId = UUID.randomUUID();

        testFacility = Facility.builder()
                .name("Boxora Thủ Đức")
                .code("HCM-TD")
                .address("123 Võ Văn Ngân, TP. Thủ Đức")
                .build();
        testFacility.setId(UUID.randomUUID());

        testUnit = StorageUnit.builder()
                .unitCode("TD-S-101")
                .facility(testFacility)
                .build();
        testUnit.setId(UUID.randomUUID());

        testCustomer = User.builder()
                .fullName("Nguyễn Văn A")
                .phone("0901234567")
                .email("nguyenvana@example.com")
                .build();
        testCustomer.setId(UUID.randomUUID());

        testContract = RentalContract.builder()
                .contractCode("CTR-2026-001")
                .facility(testFacility)
                .unit(testUnit)
                .customer(testCustomer)
                .monthlyFee(BigDecimal.valueOf(1500000))
                .depositHeld(BigDecimal.valueOf(1500000))
                .status(RentalContractStatus.ACTIVE)
                .startDate(LocalDate.now().minusDays(40))
                .endDate(LocalDate.now().minusDays(10))
                .overduePinStatus(OverduePinStatus.PIN_REVOKED)
                .overdueSealingStatus(OverdueSealingStatus.NONE)
                .build();
        testContract.setId(contractId);
    }

    @Test
    @DisplayName("Should return contract detail with mapped and sorted audit logs when audit logs exist")
    void shouldReturnContractDetailWithAuditLogs_whenAuditLogsExist() {
        // Arrange
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(testContract));

        LocalDateTime now = LocalDateTime.now();
        OverdueAuditLog log1 = OverdueAuditLog.builder()
                .contract(testContract)
                .action("OVERDUE_DETECTED")
                .performedByName("Hệ thống Boxora")
                .performedByRole("SYSTEM")
                .beforeState("ACTIVE")
                .afterState("OVERDUE")
                .details("Hợp đồng quá hạn 1 ngày. Đang trong thời gian ân hạn.")
                .build();
        log1.setId(UUID.randomUUID());
        log1.setCreatedAt(now.minusDays(9));
        log1.setUpdatedAt(now.minusDays(9));

        OverdueAuditLog log2 = OverdueAuditLog.builder()
                .contract(testContract)
                .action("PIN_REVOCATION_EXECUTED")
                .performedByName("Quản lý cơ sở")
                .performedByRole("FACILITY_MANAGER")
                .beforeState("PIN_ACTIVE")
                .afterState("PIN_REVOKED")
                .details("Thu hồi mã PIN thành công sau 3 ngày quá hạn.")
                .build();
        log2.setId(UUID.randomUUID());
        log2.setCreatedAt(now.minusDays(7));
        log2.setUpdatedAt(now.minusDays(7));

        when(overdueAuditLogRepository.findByContract_IdOrderByCreatedAtDesc(contractId))
                .thenReturn(List.of(log2, log1));

        OverdueDebtCalculationService.CalculationResult calcResult = new OverdueDebtCalculationService.CalculationResult(
                10L,
                BigDecimal.valueOf(1500000),
                BigDecimal.valueOf(200000),
                BigDecimal.valueOf(1400000),
                BigDecimal.valueOf(2900000),
                BigDecimal.ZERO,
                OverdueStage.PIN_REVOCATION,
                true,
                null,
                LocalDate.now().minusDays(10),
                LocalDate.now(),
                "1.500.000 + (7 ngày x 200.000) = 2.900.000 ₫"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any()))
                .thenReturn(calcResult);

        // Act
        OverdueContractDetailResponse response = overdueManagementService.getOverdueContractDetail(contractId);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getContractId()).isEqualTo(contractId);
        assertThat(response.getContractCode()).isEqualTo("CTR-2026-001");
        assertThat(response.getUnitCode()).isEqualTo("TD-S-101");
        assertThat(response.getCustomerName()).isEqualTo("Nguyễn Văn A");

        // Verify Audit Logs mapping & order
        assertThat(response.getAuditLogs()).hasSize(2);
        OverdueContractDetailResponse.AuditLogDto firstLog = response.getAuditLogs().get(0);
        assertThat(firstLog.getAction()).isEqualTo("PIN_REVOCATION_EXECUTED");
        assertThat(firstLog.getPerformedByName()).isEqualTo("Quản lý cơ sở");
        assertThat(firstLog.getPerformedByRole()).isEqualTo("FACILITY_MANAGER");
        assertThat(firstLog.getBeforeState()).isEqualTo("PIN_ACTIVE");
        assertThat(firstLog.getAfterState()).isEqualTo("PIN_REVOKED");

        OverdueContractDetailResponse.AuditLogDto secondLog = response.getAuditLogs().get(1);
        assertThat(secondLog.getAction()).isEqualTo("OVERDUE_DETECTED");
        assertThat(secondLog.getPerformedByName()).isEqualTo("Hệ thống Boxora");

        verify(facilityAccessGuard).checkFacilityAccess(testFacility.getId());
    }

    @Test
    @DisplayName("Should return contract detail with empty audit logs list when no logs exist")
    void shouldReturnContractDetailWithEmptyAuditLogs_whenNoAuditLogsExist() {
        // Arrange
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(testContract));
        when(overdueAuditLogRepository.findByContract_IdOrderByCreatedAtDesc(contractId))
                .thenReturn(Collections.emptyList());

        OverdueDebtCalculationService.CalculationResult calcResult = new OverdueDebtCalculationService.CalculationResult(
                0L,
                BigDecimal.valueOf(1500000),
                BigDecimal.valueOf(200000),
                BigDecimal.ZERO,
                BigDecimal.valueOf(1500000),
                BigDecimal.ZERO,
                OverdueStage.GRACE_PERIOD,
                true,
                null,
                LocalDate.now(),
                LocalDate.now(),
                "Trong thời gian ân hạn"
        );
        when(overdueDebtCalculationService.calculateOverdueDebt(any(), any(), any()))
                .thenReturn(calcResult);

        // Act
        OverdueContractDetailResponse response = overdueManagementService.getOverdueContractDetail(contractId);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getAuditLogs()).isNotNull();
        assertThat(response.getAuditLogs()).isEmpty();
    }

    @Test
    @DisplayName("Should throw AppException when contract is not found")
    void shouldThrowException_whenContractNotFound() {
        // Arrange
        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(AppException.class, () -> overdueManagementService.getOverdueContractDetail(contractId));
    }
}
