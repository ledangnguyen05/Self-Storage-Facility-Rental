package com.boxora.service;

import com.boxora.dto.request.SealingCreateRequest;
import com.boxora.dto.request.SealingUnsealRequest;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.entity.*;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.SealingStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.SealingServiceImpl;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SealingServiceTest {

    @Mock
    private SealingRecordRepository sealingRecordRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private SealingServiceImpl sealingService;

    private Facility mockFacility;
    private StorageUnit mockUnit;
    private RentalContract mockContract;
    private User mockCustomer;
    private User mockPerformer;
    private User mockWitness;

    private UUID contractId;
    private UUID unitId;
    private UUID facilityId;
    private UUID performerId;
    private UUID witnessId;

    @BeforeEach
    void setUp() {
        contractId = UUID.randomUUID();
        unitId = UUID.randomUUID();
        facilityId = UUID.randomUUID();
        performerId = UUID.randomUUID();
        witnessId = UUID.randomUUID();

        mockFacility = Facility.builder().name("Boxora Thủ Đức").build();
        mockFacility.setId(facilityId);

        mockUnit = StorageUnit.builder()
                .unitCode("TD-101")
                .facility(mockFacility)
                .status(UnitStatus.OCCUPIED)
                .build();
        mockUnit.setId(unitId);

        mockCustomer = User.builder()
                .fullName("Trần Thị B")
                .email("b.tran@example.com")
                .phone("0909123456")
                .isActive(true)
                .build();
        mockCustomer.setId(UUID.randomUUID());

        mockPerformer = User.builder()
                .username("staff_user")
                .fullName("Nhân Viên A")
                .isActive(true)
                .build();
        mockPerformer.setId(performerId);

        mockWitness = User.builder()
                .username("witness_user")
                .fullName("Bảo Vệ B")
                .isActive(true)
                .build();
        mockWitness.setId(witnessId);

        mockContract = RentalContract.builder()
                .contractCode("CTR-TEST-001")
                .facility(mockFacility)
                .unit(mockUnit)
                .customer(mockCustomer)
                .monthlyFee(new BigDecimal("1500000"))
                .status(RentalContractStatus.ACTIVE)
                .startDate(LocalDate.now().minusMonths(2))
                .endDate(LocalDate.now().minusDays(15)) // 15 ngày quá hạn
                .build();
        mockContract.setId(contractId);
    }

    @Test
    @DisplayName("createSealing should create SealingRecord, set unit and contract to OVERDUE_LOCKED")
    void testCreateSealingSuccess() {
        SealingCreateRequest request = SealingCreateRequest.builder()
                .contractId(contractId)
                .witnessId(witnessId)
                .sealTagNumber("SEAL-TAG-9999")
                .reason("Nợ cước quá hạn 15 ngày vượt ngưỡng niêm phong")
                .inventorySummary("1 tủ lạnh, 2 thùng carton")
                .notes("Đã dán niêm phong trước sự chứng kiến của bảo vệ")
                .build();

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(sealingRecordRepository.existsByUnitIdAndStatus(unitId, SealingStatus.SEALED)).thenReturn(false);
        when(requestContext.currentUserId()).thenReturn(performerId);
        when(userRepository.findById(performerId)).thenReturn(Optional.of(mockPerformer));
        when(userRepository.findById(witnessId)).thenReturn(Optional.of(mockWitness));
        when(facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facilityId)).thenReturn(Optional.empty());
        when(sealingRecordRepository.save(any(SealingRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        SealingRecordResponse response = sealingService.createSealing(request);

        assertThat(response).isNotNull();
        assertThat(response.getSealTagNumber()).isEqualTo("SEAL-TAG-9999");
        assertThat(response.getStatus()).isEqualTo(SealingStatus.SEALED);
        assertThat(response.getOverdueDays()).isEqualTo(15L);
        assertThat(mockUnit.getStatus()).isEqualTo(UnitStatus.OVERDUE_LOCKED);
        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE_LOCKED);

        verify(storageUnitRepository).save(mockUnit);
        verify(rentalContractRepository).save(mockContract);
        verify(emailService).sendSealingNoticeEmail(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyLong(), any(), anyString());
    }

    @Test
    @DisplayName("createSealing should throw UNIT_ALREADY_SEALED if unit is currently sealed")
    void testCreateSealingThrowsWhenAlreadySealed() {
        SealingCreateRequest request = SealingCreateRequest.builder()
                .contractId(contractId)
                .witnessId(witnessId)
                .sealTagNumber("SEAL-TAG-9999")
                .reason("Lý do niêm phong")
                .build();

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(sealingRecordRepository.existsByUnitIdAndStatus(unitId, SealingStatus.SEALED)).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> sealingService.createSealing(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNIT_ALREADY_SEALED);
    }

    @Test
    @DisplayName("createSealing should throw SEALING_WITNESS_REQUIRED if witness is the same as performer")
    void testCreateSealingThrowsWhenPerformerIsWitness() {
        SealingCreateRequest request = SealingCreateRequest.builder()
                .contractId(contractId)
                .witnessId(performerId) // Same as performer
                .sealTagNumber("SEAL-TAG-9999")
                .reason("Lý do niêm phong")
                .build();

        when(rentalContractRepository.findById(contractId)).thenReturn(Optional.of(mockContract));
        when(sealingRecordRepository.existsByUnitIdAndStatus(unitId, SealingStatus.SEALED)).thenReturn(false);
        when(requestContext.currentUserId()).thenReturn(performerId);
        when(userRepository.findById(performerId)).thenReturn(Optional.of(mockPerformer));

        AppException ex = assertThrows(AppException.class, () -> sealingService.createSealing(request));
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SEALING_WITNESS_REQUIRED);
    }

    @Test
    @DisplayName("unseal should change record to UNSEALED, restore unit status, and send notice email")
    void testUnsealSuccess() {
        UUID sealingId = UUID.randomUUID();
        SealingRecord record = SealingRecord.builder()
                .protocolNumber("SEAL-123456")
                .contract(mockContract)
                .unit(mockUnit)
                .facility(mockFacility)
                .performedBy(mockPerformer)
                .witness(mockWitness)
                .sealTagNumber("SEAL-TAG-9999")
                .reason("Nợ quá hạn")
                .status(SealingStatus.SEALED)
                .sealedAt(LocalDateTime.now().minusDays(3))
                .build();
        record.setId(sealingId);

        mockUnit.setStatus(UnitStatus.OVERDUE_LOCKED);
        mockContract.setStatus(RentalContractStatus.OVERDUE_LOCKED);
        mockContract.setEndDate(LocalDate.now().plusMonths(1)); // Còn hạn

        when(sealingRecordRepository.findById(sealingId)).thenReturn(Optional.of(record));
        when(requestContext.currentUserId()).thenReturn(performerId);
        when(userRepository.findById(performerId)).thenReturn(Optional.of(mockPerformer));
        when(sealingRecordRepository.save(any(SealingRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        SealingUnsealRequest unsealRequest = SealingUnsealRequest.builder()
                .reason("Khách hàng đã thanh toán đầy đủ công nợ")
                .notes("Đã kiểm tra biên lai chuyển khoản ngân hàng")
                .build();

        SealingRecordResponse response = sealingService.unseal(sealingId, unsealRequest);

        assertThat(response.getStatus()).isEqualTo(SealingStatus.UNSEALED);
        assertThat(mockUnit.getStatus()).isEqualTo(UnitStatus.OCCUPIED);
        assertThat(mockContract.getStatus()).isEqualTo(RentalContractStatus.ACTIVE);

        verify(storageUnitRepository).save(mockUnit);
        verify(rentalContractRepository).save(mockContract);
        verify(emailService).sendUnsealingNoticeEmail(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
    }
}
