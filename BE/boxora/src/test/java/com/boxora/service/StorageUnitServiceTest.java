package com.boxora.service;

import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.response.StorageUnitResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.RentalContractStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.impl.StorageUnitServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StorageUnitServiceTest {

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private FacilityPolicyRepository facilityPolicyRepository;

    @Mock
    private UnitTypeRepository unitTypeRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private StorageUnitPriceHistoryService storageUnitPriceHistoryService;

    @Mock
    private ActivityLogService activityLogService;

    @InjectMocks
    private StorageUnitServiceImpl storageUnitService;

    private UUID facilityId;
    private UUID unitId;
    private Facility facility;
    private UnitType unitType;
    private StorageUnit unit;

    @BeforeEach
    void setUp() {
        facilityId = UUID.randomUUID();
        unitId = UUID.randomUUID();

        facility = Facility.builder()
                .name("Boxora Central")
                .address("123 Vo Van Ngan, Thu Duc, TP.HCM")
                .build();
        facility.setId(facilityId);

        unitType = UnitType.builder()
                .typeName("Kho Tiêu Chuẩn 3m²")
                .dimensions("1.5m x 2m x 2.5m")
                .areaSqm(3.0)
                .basePricePerMonth(BigDecimal.valueOf(1500000))
                .build();
        unitType.setId(UUID.randomUUID());

        unit = StorageUnit.builder()
                .unitCode("U-101")
                .floorLevel("1")
                .facility(facility)
                .unitType(unitType)
                .status(UnitStatus.AVAILABLE)
                .pricePerMonth(BigDecimal.valueOf(1500000))
                .build();
        unit.setId(unitId);
    }

    @Nested
    @DisplayName("Toggle Maintenance - Security & Access Control")
    class ToggleMaintenanceSecurityTests {

        @Test
        @DisplayName("TC-SU-01: Chặn toggle bảo trì nếu user không có quyền truy cập cơ sở (FACILITY_ACCESS_DENIED)")
        void toggleMaintenance_CrossFacility_ThrowsFacilityAccessDenied() {
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            doThrow(new AppException(ErrorCode.FACILITY_ACCESS_DENIED))
                    .when(facilityAccessGuard).checkFacilityAccess(facilityId);

            AppException ex = assertThrows(AppException.class, () -> storageUnitService.toggleMaintenance(unitId));
            assertEquals(ErrorCode.FACILITY_ACCESS_DENIED, ex.getErrorCode());
            verify(storageUnitRepository, never()).save(any());
        }

        @Test
        @DisplayName("TC-SU-02: Xác nhận toggle-maintenance sử dụng Pessimistic Write Lock (findWithDetailsByIdForUpdate)")
        void toggleMaintenance_UsesPessimisticWriteLock() {
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(false);
            when(bookingRepository.existsByStorageUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(false);
            when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(i -> i.getArgument(0));

            storageUnitService.toggleMaintenance(unitId);

            verify(storageUnitRepository, times(1)).findWithDetailsByIdForUpdate(unitId);
            verify(storageUnitRepository, never()).findWithDetailsById(unitId);
        }
    }

    @Nested
    @DisplayName("Toggle Maintenance - Business Logic & State Recovery")
    class ToggleMaintenanceBusinessTests {

        @Test
        @DisplayName("TC-SU-03: Chặn chuyển sang bảo trì nếu kho đang OCCUPIED (STORAGE_UNIT_CANNOT_MAINTAIN)")
        void toggleMaintenance_WhenOccupied_ThrowsCannotMaintain() {
            unit.setStatus(UnitStatus.OCCUPIED);
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));

            AppException ex = assertThrows(AppException.class, () -> storageUnitService.toggleMaintenance(unitId));
            assertEquals(ErrorCode.STORAGE_UNIT_CANNOT_MAINTAIN, ex.getErrorCode());
            verify(storageUnitRepository, never()).save(any());
        }

        @Test
        @DisplayName("TC-SU-04: Chặn chuyển sang bảo trì nếu kho đang RESERVED (STORAGE_UNIT_CANNOT_MAINTAIN)")
        void toggleMaintenance_WhenReserved_ThrowsCannotMaintain() {
            unit.setStatus(UnitStatus.RESERVED);
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));

            AppException ex = assertThrows(AppException.class, () -> storageUnitService.toggleMaintenance(unitId));
            assertEquals(ErrorCode.STORAGE_UNIT_CANNOT_MAINTAIN, ex.getErrorCode());
            verify(storageUnitRepository, never()).save(any());
        }

        @Test
        @DisplayName("TC-SU-05: Chặn bảo trì nếu kho AVAILABLE nhưng đang có hợp đồng hiệu lực (STORAGE_UNIT_IN_USE)")
        void toggleMaintenance_WhenAvailableWithActiveContract_ThrowsStorageUnitInUse() {
            unit.setStatus(UnitStatus.AVAILABLE);
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () -> storageUnitService.toggleMaintenance(unitId));
            assertEquals(ErrorCode.STORAGE_UNIT_IN_USE, ex.getErrorCode());
            verify(storageUnitRepository, never()).save(any());
        }

        @Test
        @DisplayName("TC-SU-06: Chặn bảo trì nếu kho AVAILABLE nhưng đang có booking xác nhận/chờ xử lý (STORAGE_UNIT_IN_USE)")
        void toggleMaintenance_WhenAvailableWithConfirmedBooking_ThrowsStorageUnitInUse() {
            unit.setStatus(UnitStatus.AVAILABLE);
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(false);
            when(bookingRepository.existsByStorageUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () -> storageUnitService.toggleMaintenance(unitId));
            assertEquals(ErrorCode.STORAGE_UNIT_IN_USE, ex.getErrorCode());
            verify(storageUnitRepository, never()).save(any());
        }

        @Test
        @DisplayName("TC-SU-07: Chuyển sang UNDER_MAINTENANCE thành công khi kho AVAILABLE và không bị ràng buộc")
        void toggleMaintenance_WhenAvailable_SuccessfullyTransitionsToUnderMaintenance() {
            unit.setStatus(UnitStatus.AVAILABLE);
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(false);
            when(bookingRepository.existsByStorageUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(false);
            when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(i -> i.getArgument(0));

            StorageUnitResponse resp = storageUnitService.toggleMaintenance(unitId);

            assertThat(resp.getStatus()).isEqualTo(UnitStatus.UNDER_MAINTENANCE.name());
            verify(activityLogService, times(1)).record(
                    eq(facilityId),
                    eq(ActivityAction.STORAGE_UNIT_STATUS_CHANGE),
                    eq("StorageUnit"),
                    eq(unitId),
                    anyString(),
                    eq(UnitStatus.AVAILABLE),
                    eq(UnitStatus.UNDER_MAINTENANCE)
            );
        }

        @Test
        @DisplayName("TC-SU-08: Tắt bảo trì khi có hợp đồng ACTIVE: Phục hồi OCCUPIED, không được nhầm lẫn thành AVAILABLE")
        void toggleMaintenance_WhenUnderMaintenanceAndActiveContract_RestoresOccupied() {
            unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(
                    eq(unitId), eq(List.of(RentalContractStatus.ACTIVE))
            )).thenReturn(true);
            when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(i -> i.getArgument(0));

            StorageUnitResponse resp = storageUnitService.toggleMaintenance(unitId);

            assertThat(resp.getStatus()).isEqualTo(UnitStatus.OCCUPIED.name());
            verify(activityLogService, times(1)).record(
                    eq(facilityId),
                    eq(ActivityAction.STORAGE_UNIT_STATUS_CHANGE),
                    eq("StorageUnit"),
                    eq(unitId),
                    anyString(),
                    eq(UnitStatus.UNDER_MAINTENANCE),
                    eq(UnitStatus.OCCUPIED)
            );
        }

        @Test
        @DisplayName("TC-SU-09: Tắt bảo trì khi có booking CONFIRMED: Phục hồi RESERVED")
        void toggleMaintenance_WhenUnderMaintenanceAndConfirmedBooking_RestoresReserved() {
            unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(
                    eq(unitId), eq(List.of(RentalContractStatus.ACTIVE))
            )).thenReturn(false);
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(
                    eq(unitId), eq(List.of(RentalContractStatus.PENDING_ACTIVATION))
            )).thenReturn(false);
            when(bookingRepository.existsByStorageUnit_IdAndStatusIn(
                    eq(unitId), eq(List.of(com.boxora.enums.BookingStatus.CONFIRMED))
            )).thenReturn(true);
            when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(i -> i.getArgument(0));

            StorageUnitResponse resp = storageUnitService.toggleMaintenance(unitId);

            assertThat(resp.getStatus()).isEqualTo(UnitStatus.RESERVED.name());
        }

        @Test
        @DisplayName("TC-SU-10: Tắt bảo trì khi không có hợp đồng/booking: Phục hồi AVAILABLE")
        void toggleMaintenance_WhenUnderMaintenanceAndNoLease_RestoresAvailable() {
            unit.setStatus(UnitStatus.UNDER_MAINTENANCE);
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(
                    eq(unitId), eq(List.of(RentalContractStatus.ACTIVE))
            )).thenReturn(false);
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(
                    eq(unitId), eq(List.of(RentalContractStatus.PENDING_ACTIVATION))
            )).thenReturn(false);
            when(bookingRepository.existsByStorageUnit_IdAndStatusIn(
                    eq(unitId), eq(List.of(com.boxora.enums.BookingStatus.CONFIRMED))
            )).thenReturn(false);
            when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(i -> i.getArgument(0));

            StorageUnitResponse resp = storageUnitService.toggleMaintenance(unitId);

            assertThat(resp.getStatus()).isEqualTo(UnitStatus.AVAILABLE.name());
        }
    }

    @Nested
    @DisplayName("Update Storage Unit & Hardware/IoT Data Honesty")
    class UpdateAndHardwareTests {

        @Test
        @DisplayName("TC-SU-11: Chặn đổi mã kho hoặc loại kho khi kho đang OCCUPIED")
        void updateUnit_WhenOccupied_ThrowsStorageUnitInUse() {
            unit.setStatus(UnitStatus.OCCUPIED);
            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(unit));

            StorageUnitUpdateRequest req = new StorageUnitUpdateRequest();
            req.setUnitCode("U-NEW-CODE");
            req.setUnitTypeId(UUID.randomUUID());

            AppException ex = assertThrows(AppException.class, () -> storageUnitService.updateUnit(unitId, req));
            assertEquals(ErrorCode.STORAGE_UNIT_IN_USE, ex.getErrorCode());
        }

        @Test
        @DisplayName("TC-SU-12: Chặn đổi mã kho hoặc loại kho khi kho đang RESERVED")
        void updateUnit_WhenReserved_ThrowsStorageUnitInUse() {
            unit.setStatus(UnitStatus.RESERVED);
            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(unit));

            StorageUnitUpdateRequest req = new StorageUnitUpdateRequest();
            req.setUnitCode("U-NEW-CODE");

            AppException ex = assertThrows(AppException.class, () -> storageUnitService.updateUnit(unitId, req));
            assertEquals(ErrorCode.STORAGE_UNIT_IN_USE, ex.getErrorCode());
        }

        @Test
        @DisplayName("TC-SU-13: Dữ liệu IoT Pin và SmartLock Serial phải trả về null khi không có nguồn phần cứng thật")
        void mapToResponse_IotDataHonesty_NullWhenNoHardwareSource() {
            when(storageUnitRepository.findWithDetailsByIdForUpdate(unitId)).thenReturn(Optional.of(unit));
            when(rentalContractRepository.existsByUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(false);
            when(bookingRepository.existsByStorageUnit_IdAndStatusIn(eq(unitId), anyCollection())).thenReturn(false);
            when(storageUnitRepository.save(any(StorageUnit.class))).thenAnswer(i -> i.getArgument(0));

            StorageUnitResponse resp = storageUnitService.toggleMaintenance(unitId);

            assertNull(resp.getBatteryLevel(), "BatteryLevel không được hardcode giá trị giả 98% hay 95%");
            assertNull(resp.getSmartLockSerial(), "SmartLockSerial không được hardcode SL-...");
        }
    }
}

