package com.boxora.service;

import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypePriceAdjustmentRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.dto.response.UnitTypeResponse;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.UnitTypeMapper;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.UnitTypeServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UnitTypeServiceTest {

    @Mock
    private UnitTypeRepository unitTypeRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UnitTypeMapper unitTypeMapper;

    @Mock
    private StorageUnitPriceHistoryService storageUnitPriceHistoryService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private UnitTypeServiceImpl unitTypeService;

    private UUID unitTypeId;
    private UnitType unitType;
    private User adminUser;

    @BeforeEach
    void setUp() {
        unitTypeId = UUID.randomUUID();
        unitType = UnitType.builder()
                .typeName("Compact Studio Unit")
                .dimensions("1.5m x 2.0m x 2.6m")
                .areaSqm(3.0)
                .basePricePerMonth(new BigDecimal("1250000.00"))
                .depositAmount(new BigDecimal("1250000.00"))
                .build();
        unitType.setId(unitTypeId);

        adminUser = User.builder()
                .username("admin")
                .fullName("System Admin")
                .build();
        adminUser.setId(UUID.randomUUID());
    }

    @Nested
    @DisplayName("createUnitType Tests")
    class CreateUnitTypeTests {

        @Test
        @DisplayName("Tạo loại kho thành công và khởi tạo lịch sử giá")
        void shouldCreateUnitTypeSuccessfully() {
            UnitTypeCreateRequest request = UnitTypeCreateRequest.builder()
                    .typeName("Personal Locker")
                    .dimensions("1.0m x 1.0m x 1.2m")
                    .areaSqm(1.0)
                    .basePricePerMonth(new BigDecimal("450000.00"))
                    .depositAmount(new BigDecimal("450000.00"))
                    .build();

            when(unitTypeRepository.existsByTypeNameIgnoreCase("Personal Locker")).thenReturn(false);
            when(unitTypeRepository.save(any(UnitType.class))).thenAnswer(invocation -> {
                UnitType ut = invocation.getArgument(0);
                ut.setId(UUID.randomUUID());
                return ut;
            });

            UnitTypeResponse response = UnitTypeResponse.builder()
                    .id(UUID.randomUUID())
                    .typeName("Personal Locker")
                    .basePricePerMonth(new BigDecimal("450000.00"))
                    .activeUnitsCount(0L)
                    .build();
            when(unitTypeMapper.toResponse(any(UnitType.class), eq(0L))).thenReturn(response);

            UnitTypeResponse result = unitTypeService.createUnitType(request);

            assertThat(result).isNotNull();
            assertThat(result.getTypeName()).isEqualTo("Personal Locker");
            verify(storageUnitPriceHistoryService).recordInitialUnitTypePrice(any(), eq(new BigDecimal("450000.00")), any());
            verify(activityLogService).record(eq(ActivityAction.UNIT_TYPE_CREATE), eq("UnitType"), any(), any(), isNull(), any());
        }

        @Test
        @DisplayName("Báo lỗi nếu tên loại kho đã tồn tại")
        void shouldThrowWhenTypeNameAlreadyExists() {
            UnitTypeCreateRequest request = UnitTypeCreateRequest.builder()
                    .typeName("Compact Studio Unit")
                    .dimensions("1.5m x 2.0m x 2.6m")
                    .areaSqm(3.0)
                    .basePricePerMonth(new BigDecimal("1250000.00"))
                    .depositAmount(new BigDecimal("1250000.00"))
                    .build();

            when(unitTypeRepository.existsByTypeNameIgnoreCase("Compact Studio Unit")).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () -> unitTypeService.createUnitType(request));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNIT_TYPE_NAME_EXISTED);
        }
    }

    @Nested
    @DisplayName("updateUnitType & adjustPrice Tests")
    class UpdateAndAdjustPriceTests {

        @Test
        @DisplayName("Cập nhật loại kho và ghi lịch sử giá khi có thay đổi đơn giá")
        void shouldUpdateUnitTypeAndRecordPriceHistory() {
            UnitTypeUpdateRequest request = UnitTypeUpdateRequest.builder()
                    .typeName("Compact Studio Unit Pro")
                    .basePricePerMonth(new BigDecimal("1350000.00"))
                    .priceChangeReason("Tăng giá niêm yết theo chu kỳ")
                    .build();

            when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(unitType));
            when(unitTypeRepository.existsByTypeNameIgnoreCaseAndIdNot("Compact Studio Unit Pro", unitTypeId)).thenReturn(false);
            when(unitTypeRepository.save(any(UnitType.class))).thenReturn(unitType);
            when(storageUnitRepository.countByUnitType_Id(unitTypeId)).thenReturn(5L);

            UnitTypeResponse expectedResponse = UnitTypeResponse.builder()
                    .id(unitTypeId)
                    .typeName("Compact Studio Unit Pro")
                    .basePricePerMonth(new BigDecimal("1350000.00"))
                    .activeUnitsCount(5L)
                    .build();
            when(unitTypeMapper.toResponse(unitType, 5L)).thenReturn(expectedResponse);

            UnitTypeResponse result = unitTypeService.updateUnitType(unitTypeId, request);

            assertThat(result.getTypeName()).isEqualTo("Compact Studio Unit Pro");
            verify(storageUnitPriceHistoryService).adjustUnitTypePrice(eq(unitTypeId), any());
            verify(activityLogService).record(eq(ActivityAction.UNIT_TYPE_UPDATE), eq("UnitType"), eq(unitTypeId), any(), isNull(), any());
        }

        @Test
        @DisplayName("Điều chỉnh giá loại kho và cascade cho các kho AVAILABLE")
        void shouldAdjustPriceAndCascadeToAvailableUnits() {
            UnitTypePriceAdjustmentRequest request = UnitTypePriceAdjustmentRequest.builder()
                    .newPrice(new BigDecimal("1400000.00"))
                    .reason("Điều chỉnh giá trượt giá kinh doanh")
                    .cascadeToAvailableUnits(true)
                    .build();

            StorageUnit availableUnit = StorageUnit.builder()
                    .unitCode("A-101")
                    .status(UnitStatus.AVAILABLE)
                    .unitType(unitType)
                    .pricePerMonth(new BigDecimal("1250000.00"))
                    .build();

            StorageUnit occupiedUnit = StorageUnit.builder()
                    .unitCode("A-102")
                    .status(UnitStatus.OCCUPIED)
                    .unitType(unitType)
                    .pricePerMonth(new BigDecimal("1250000.00"))
                    .build();

            when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(unitType));
            when(storageUnitRepository.findByUnitType_Id(unitTypeId)).thenReturn(List.of(availableUnit, occupiedUnit));
            when(storageUnitRepository.countByUnitType_Id(unitTypeId)).thenReturn(2L);

            UnitTypeResponse expectedResponse = UnitTypeResponse.builder()
                    .id(unitTypeId)
                    .basePricePerMonth(new BigDecimal("1400000.00"))
                    .activeUnitsCount(2L)
                    .build();
            when(unitTypeMapper.toResponse(unitType, 2L)).thenReturn(expectedResponse);

            UnitTypeResponse result = unitTypeService.adjustPrice(unitTypeId, request);

            assertThat(result.getBasePricePerMonth()).isEqualTo(new BigDecimal("1400000.00"));
            verify(storageUnitPriceHistoryService).adjustUnitTypePrice(eq(unitTypeId), any());
            // Kho AVAILABLE được cập nhật đơn giá mới
            assertThat(availableUnit.getPricePerMonth()).isEqualTo(new BigDecimal("1400000.00"));
            // Kho OCCUPIED giữ nguyên giá cũ theo Grandfathering clause
            assertThat(occupiedUnit.getPricePerMonth()).isEqualTo(new BigDecimal("1250000.00"));
            verify(storageUnitRepository).save(availableUnit);
            verify(storageUnitRepository, never()).save(occupiedUnit);
        }
    }

    @Nested
    @DisplayName("deleteUnitType Tests")
    class DeleteUnitTypeTests {

        @Test
        @DisplayName("Xóa loại kho thành công khi không có kho nào đang sử dụng")
        void shouldDeleteUnitTypeSuccessfully() {
            when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(unitType));
            when(storageUnitRepository.existsByUnitType_Id(unitTypeId)).thenReturn(false);

            unitTypeService.deleteUnitType(unitTypeId);

            verify(unitTypeRepository).delete(unitType);
            verify(activityLogService).record(eq(ActivityAction.UNIT_TYPE_DELETE), eq("UnitType"), eq(unitTypeId), any(), any(), isNull());
        }

        @Test
        @DisplayName("Không cho phép xóa loại kho khi đã có kho lưu trữ liên kết")
        void shouldThrowWhenUnitTypeIsInUse() {
            when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(unitType));
            when(storageUnitRepository.existsByUnitType_Id(unitTypeId)).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () -> unitTypeService.deleteUnitType(unitTypeId));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.UNIT_TYPE_IN_USE);
            verify(unitTypeRepository, never()).delete(any());
        }
    }

    @Nested
    @DisplayName("Query Tests")
    class QueryTests {

        @Test
        @DisplayName("Lấy chi tiết loại kho kèm số lượng kho")
        void shouldGetByIdWithActiveUnitsCount() {
            when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(unitType));
            when(storageUnitRepository.countByUnitType_Id(unitTypeId)).thenReturn(8L);

            UnitTypeResponse resp = UnitTypeResponse.builder()
                    .id(unitTypeId)
                    .typeName("Compact Studio Unit")
                    .activeUnitsCount(8L)
                    .build();
            when(unitTypeMapper.toResponse(unitType, 8L)).thenReturn(resp);

            UnitTypeResponse result = unitTypeService.getById(unitTypeId);

            assertThat(result.getActiveUnitsCount()).isEqualTo(8L);
        }

        @Test
        @DisplayName("Lấy lịch sử giá của loại kho")
        void shouldGetPriceHistory() {
            StorageUnitPriceHistoryResponse historyResp = StorageUnitPriceHistoryResponse.builder()
                    .unitTypeId(unitTypeId)
                    .unitTypeName("Compact Studio Unit")
                    .oldPrice(new BigDecimal("1250000.00"))
                    .newPrice(new BigDecimal("1350000.00"))
                    .reason("Tăng giá")
                    .build();

            when(storageUnitPriceHistoryService.getPriceHistoryByUnitType(unitTypeId))
                    .thenReturn(List.of(historyResp));

            List<StorageUnitPriceHistoryResponse> histories = unitTypeService.getPriceHistory(unitTypeId);

            assertThat(histories).hasSize(1);
            assertThat(histories.get(0).getNewPrice()).isEqualTo(new BigDecimal("1350000.00"));
        }
    }
}

