package com.boxora.service;

import com.boxora.dto.request.UnsealRequest;
import com.boxora.dto.response.OverdueContractDetail;
import com.boxora.dto.response.OverdueProcessResult;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.entity.*;
import com.boxora.enums.*;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.SealingRecordMapper;
import com.boxora.repository.*;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.OverdueProcessingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OverdueProcessingServiceTest {

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private SealingRecordRepository sealingRecordRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SealingRecordMapper sealingRecordMapper;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private ActivityLogRepository activityLogRepository;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private OverdueProcessingServiceImpl overdueProcessingService;

    private Facility testFacility;
    private StorageUnit testUnit;
    private User testCustomer;
    private User testManager;
    private User testStaff;
    private Booking testBooking;
    private RentalContract testContract;

    @BeforeEach
    void setUp() {
        testFacility = Facility.builder()
                .name("Boxora Saigon Central")
                .code("FAC-001")
                .address("123 Le Loi, Q1, HCMC")
                .build();
        testFacility.setId(UUID.randomUUID());

        testUnit = StorageUnit.builder()
                .unitCode("S-101")
                .facility(testFacility)
                .status(UnitStatus.OCCUPIED)
                .build();
        testUnit.setId(UUID.randomUUID());

        testCustomer = User.builder()
                .email("customer@example.com")
                .fullName("Nguyen Van A")
                .build();
        testCustomer.setId(UUID.randomUUID());

        Role managerRole = Role.builder().name("FACILITY_MANAGER").build();
        testManager = User.builder()
                .email("manager@example.com")
                .fullName("Tran Manager")
                .role(managerRole)
                .facility(testFacility)
                .build();
        testManager.setId(UUID.randomUUID());

        Role staffRole = Role.builder().name("STAFF").build();
        testStaff = User.builder()
                .email("staff@example.com")
                .fullName("Le Staff")
                .role(staffRole)
                .facility(testFacility)
                .build();
        testStaff.setId(UUID.randomUUID());

        testBooking = Booking.builder()
                .bookingCode("BK-2026-001")
                .customer(testCustomer)
                .storageUnit(testUnit)
                .rentalMonths(1)
                .totalRentalFee(new BigDecimal("2000000.00"))
                .depositPaid(new BigDecimal("2000000.00"))
                .status(BookingStatus.ACTIVE)
                .accessPin("123456")
                .qrAccessToken("QR_VALID_TOKEN")
                .build();
        testBooking.setId(UUID.randomUUID());

        testContract = RentalContract.builder()
                .contractCode("RC-2026-001")
                .customer(testCustomer)
                .unit(testUnit)
                .facility(testFacility)
                .booking(testBooking)
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 1, 31))
                .monthlyFee(new BigDecimal("2000000.00"))
                .status(RentalContractStatus.ACTIVE)
                .build();
        testContract.setId(UUID.randomUUID());
    }

    @Nested
    @DisplayName("processOverdueContracts tests")
    class ProcessOverdueContractsTests {

        @Test
        @DisplayName("Mốc +1 ngày quá hạn: Áp dụng phạt 5% tiền thuê tháng và chuyển status sang OVERDUE")
        void testMilestone1_OverdueOneDay_ApplyFivePercentPenalty() {
            LocalDate today = LocalDate.of(2026, 2, 1); // 1 ngày sau 31/1
            when(rentalContractRepository.findActiveOrOverdueContractsBeforeDate(today))
                    .thenReturn(List.of(testContract));

            OverdueProcessResult result = overdueProcessingService.processOverdueContracts(today);

            assertThat(result.getScannedOverdueContractsCount()).isEqualTo(1);
            assertThat(result.getLatePenaltyCount()).isEqualTo(1);
            assertThat(result.getPinDisabledCount()).isEqualTo(0);
            assertThat(result.getSealedUnitsCount()).isEqualTo(0);

            assertThat(testContract.getStatus()).isEqualTo(RentalContractStatus.OVERDUE);
            // 5% của 2,000,000 = 100,000
            assertThat(result.getDetails().get(0).getLatePenaltyAmount()).isEqualByComparingTo("100000.00");
            assertThat(result.getDetails().get(0).getLatePenaltyApplied()).isTrue();
            assertThat(result.getDetails().get(0).getPinAccessDisabled()).isFalse();
            assertThat(result.getDetails().get(0).getUnitSealed()).isFalse();

            verify(activityLogService).recordSystem(
                    eq(testFacility.getId()),
                    eq(ActivityAction.OVERDUE_DETECTED),
                    eq("RentalContract"),
                    eq(testContract.getId()),
                    anyString()
            );
            verify(rentalContractRepository).save(testContract);
            verify(bookingRepository, never()).save(any());
            verify(sealingRecordRepository, never()).save(any());
        }

        @Test
        @DisplayName("Mốc +3 ngày quá hạn: Khóa mã PIN và vô hiệu hóa QR access trên Booking")
        void testMilestone2_OverdueThreeDays_DisablePinAndQr() {
            LocalDate today = LocalDate.of(2026, 2, 3); // 3 ngày sau 31/1
            when(rentalContractRepository.findActiveOrOverdueContractsBeforeDate(today))
                    .thenReturn(List.of(testContract));

            OverdueProcessResult result = overdueProcessingService.processOverdueContracts(today);

            assertThat(result.getLatePenaltyCount()).isEqualTo(1);
            assertThat(result.getPinDisabledCount()).isEqualTo(1);
            assertThat(result.getSealedUnitsCount()).isEqualTo(0);

            assertThat(testBooking.getAccessPin()).isNull();
            assertThat(testBooking.getQrAccessToken()).isEqualTo("REVOKED_OVERDUE");
            assertThat(testBooking.getStatus()).isEqualTo(BookingStatus.OVERDUE);

            verify(bookingRepository).save(testBooking);
            verify(activityLogService).recordSystem(
                    eq(testFacility.getId()),
                    eq(ActivityAction.OVERDUE_ACCESS_DISABLED),
                    eq("Booking"),
                    eq(testBooking.getId()),
                    anyString()
            );
            verify(sealingRecordRepository, never()).save(any());
        }

        @Test
        @DisplayName("Mốc +7 ngày quá hạn (BR-RULE-012): Lập biên bản SealingRecord và chuyển Unit sang UNDER_MAINTENANCE")
        void testMilestone3_OverdueSevenDays_SealUnit() {
            LocalDate today = LocalDate.of(2026, 2, 7); // 7 ngày sau 31/1
            when(rentalContractRepository.findActiveOrOverdueContractsBeforeDate(today))
                    .thenReturn(List.of(testContract));
            when(sealingRecordRepository.existsByStorageUnit_IdAndStatus(testUnit.getId(), SealingStatus.SEALED))
                    .thenReturn(false);
            when(userRepository.findAll()).thenReturn(List.of(testManager, testStaff));

            OverdueProcessResult result = overdueProcessingService.processOverdueContracts(today);

            assertThat(result.getLatePenaltyCount()).isEqualTo(1);
            assertThat(result.getPinDisabledCount()).isEqualTo(1);
            assertThat(result.getSealedUnitsCount()).isEqualTo(1);

            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.UNDER_MAINTENANCE);
            verify(storageUnitRepository).save(testUnit);
            verify(sealingRecordRepository).save(any(SealingRecord.class));

            verify(activityLogService).recordSystem(
                    eq(testFacility.getId()),
                    eq(ActivityAction.OVERDUE_SEALING_APPROVED),
                    eq("SealingRecord"),
                    any(),
                    anyString()
            );
        }

        @Test
        @DisplayName("Mốc +7 ngày quá hạn nhưng kho đã niêm phong trước đó: Không tạo trùng biên bản")
        void testMilestone3_AlreadySealed_NoDuplicateSealing() {
            LocalDate today = LocalDate.of(2026, 2, 10);
            when(rentalContractRepository.findActiveOrOverdueContractsBeforeDate(today))
                    .thenReturn(List.of(testContract));
            when(sealingRecordRepository.existsByStorageUnit_IdAndStatus(testUnit.getId(), SealingStatus.SEALED))
                    .thenReturn(true);

            OverdueProcessResult result = overdueProcessingService.processOverdueContracts(today);

            assertThat(result.getSealedUnitsCount()).isEqualTo(0);
            verify(sealingRecordRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("unsealUnit tests")
    class UnsealUnitTests {

        private SealingRecord sealedRecord;

        @BeforeEach
        void initSealedRecord() {
            testUnit.setStatus(UnitStatus.UNDER_MAINTENANCE);
            sealedRecord = SealingRecord.builder()
                    .storageUnit(testUnit)
                    .contract(testContract)
                    .facility(testFacility)
                    .sealTagNumber("SEAL-2026-S101-1234")
                    .reason("Quá hạn 7 ngày")
                    .sealedAt(LocalDateTime.now().minusDays(2))
                    .sealedBy(testManager)
                    .witness(testStaff)
                    .status(SealingStatus.SEALED)
                    .build();
            sealedRecord.setId(UUID.randomUUID());
        }

        @Test
        @DisplayName("Mở niêm phong thành công: Đổi status sang UNSEALED và hoàn trả UnitStatus về AVAILABLE")
        void testUnsealUnit_Success() {
            UUID recordId = sealedRecord.getId();
            UnsealRequest request = new UnsealRequest();
            request.setUnsealReason("Khách hàng đã nộp phạt và thanh toán toàn bộ công nợ");
            request.setPhotoEvidenceUrl("https://storage.boxora.vn/unseal-evidence.jpg");
            request.setNotes("Biên bản bàn giao số 999");

            when(sealingRecordRepository.findById(recordId)).thenReturn(Optional.of(sealedRecord));
            when(requestContext.currentUserId()).thenReturn(testManager.getId());
            when(userRepository.findById(testManager.getId())).thenReturn(Optional.of(testManager));
            when(sealingRecordRepository.save(any(SealingRecord.class))).thenAnswer(inv -> inv.getArgument(0));

            SealingRecordResponse mockResponse = SealingRecordResponse.builder()
                    .id(recordId)
                    .sealTagNumber(sealedRecord.getSealTagNumber())
                    .status(SealingStatus.UNSEALED)
                    .unsealReason(request.getUnsealReason())
                    .build();
            when(sealingRecordMapper.toResponse(any())).thenReturn(mockResponse);

            SealingRecordResponse result = overdueProcessingService.unsealUnit(recordId, request);

            assertThat(result.getStatus()).isEqualTo(SealingStatus.UNSEALED);
            assertThat(sealedRecord.getStatus()).isEqualTo(SealingStatus.UNSEALED);
            assertThat(testUnit.getStatus()).isEqualTo(UnitStatus.AVAILABLE);

            verify(storageUnitRepository).save(testUnit);
            verify(sealingRecordRepository).save(sealedRecord);
            verify(activityLogService).record(
                    eq(testFacility.getId()),
                    eq(ActivityAction.OVERDUE_UNIT_LOCKED),
                    eq("SealingRecord"),
                    eq(recordId),
                    anyString(),
                    eq(SealingStatus.SEALED.name()),
                    eq(SealingStatus.UNSEALED.name())
            );
        }

        @Test
        @DisplayName("Mở niêm phong thất bại: Ném SEALING_ALREADY_UNSEALED khi biên bản đã được mở trước đó")
        void testUnsealUnit_AlreadyUnsealed_ThrowsException() {
            UUID recordId = sealedRecord.getId();
            sealedRecord.setStatus(SealingStatus.UNSEALED);

            when(sealingRecordRepository.findById(recordId)).thenReturn(Optional.of(sealedRecord));

            UnsealRequest request = new UnsealRequest();
            request.setUnsealReason("Thử mở lại");

            AppException ex = assertThrows(AppException.class, () ->
                    overdueProcessingService.unsealUnit(recordId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SEALING_ALREADY_UNSEALED);
            verify(sealingRecordRepository, never()).save(any());
        }

        @Test
        @DisplayName("Mở niêm phong thất bại: Ném SEALING_RECORD_NOT_FOUND khi không tìm thấy record")
        void testUnsealUnit_NotFound_ThrowsException() {
            UUID randomId = UUID.randomUUID();
            when(sealingRecordRepository.findById(randomId)).thenReturn(Optional.empty());

            UnsealRequest request = new UnsealRequest();
            request.setUnsealReason("Lý do");

            AppException ex = assertThrows(AppException.class, () ->
                    overdueProcessingService.unsealUnit(randomId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.SEALING_RECORD_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("getOverdueContractsSummary tests")
    class SummaryTests {

        @Test
        @DisplayName("Lấy danh sách tổng hợp hợp đồng quá hạn thành công")
        void testGetOverdueContractsSummary() {
            when(rentalContractRepository.findActiveOrOverdueContractsBeforeDate(any(LocalDate.class)))
                    .thenReturn(List.of(testContract));

            List<OverdueContractDetail> list = overdueProcessingService.getOverdueContractsSummary();

            assertThat(list).hasSize(1);
            assertThat(list.get(0).getContractCode()).isEqualTo("RC-2026-001");
            assertThat(list.get(0).getCustomerEmail()).isEqualTo("customer@example.com");
            assertThat(list.get(0).getLatePenaltyApplied()).isTrue();
        }
    }
}
