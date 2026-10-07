package com.boxora.service;

import com.boxora.dto.request.StorageUnitPriceAdjustmentRequest;
import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.entity.*;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.StorageUnitPriceHistoryMapper;
import com.boxora.repository.StorageUnitPriceHistoryRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.StorageUnitPriceHistoryServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StorageUnitPriceHistoryServiceTest {

    @Mock
    private StorageUnitPriceHistoryRepository storageUnitPriceHistoryRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StorageUnitPriceHistoryMapper storageUnitPriceHistoryMapper;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private StorageUnitPriceHistoryServiceImpl storageUnitPriceHistoryService;

    private Facility facility;
    private UnitType unitType;
    private StorageUnit storageUnit;
    private User managerUser;
    private UUID unitId;

    @BeforeEach
    void setUp() {
        facility = Facility.builder()
                .name("StoreHub District 1")
                .code("HCM-D1")
                .build();
        facility.setId(UUID.randomUUID());

        unitType = UnitType.builder()
                .typeName("Standard Small")
                .basePricePerMonth(new BigDecimal("1000000.00"))
                .build();
        unitType.setId(UUID.randomUUID());

        unitId = UUID.randomUUID();
        storageUnit = StorageUnit.builder()
                .unitCode("A-101")
                .floorLevel("Floor 1")
                .status(UnitStatus.AVAILABLE)
                .facility(facility)
                .unitType(unitType)
                .pricePerMonth(new BigDecimal("1000000.00"))
                .build();
        storageUnit.setId(unitId);

        Role managerRole = Role.builder().name("FACILITY_MANAGER").build();
        managerUser = User.builder()
                .username("manager1")
                .fullName("Nguyen Van Quan Ly")
                .role(managerRole)
                .facility(facility)
                .build();
        managerUser.setId(UUID.randomUUID());
    }

    @Nested
    @DisplayName("Nghiệp vụ BR-RULE-011: Điều chỉnh giá và ghi nhận lịch sử")
    class PriceAdjustmentRule011Tests {

        @Test
        @DisplayName("BR-RULE-011.1: Điều chỉnh giá thành công -> Lưu vết lịch sử và ghi ActivityLog")
        void adjustUnitPrice_Success() {
            // Arrange
            StorageUnitPriceAdjustmentRequest request = StorageUnitPriceAdjustmentRequest.builder()
                    .newPrice(new BigDecimal("1250000.00"))
                    .reason("Tăng giá định kỳ theo chi phí năng lượng và bảo trì")
                    .effectiveFrom(LocalDateTime.now())
                    .build();

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(storageUnit));
            when(requestContext.currentUserRole()).thenReturn("FACILITY_MANAGER");
            when(requestContext.currentUserId()).thenReturn(managerUser.getId());
            when(userRepository.findById(managerUser.getId())).thenReturn(Optional.of(managerUser));
            when(storageUnitPriceHistoryRepository.save(any(StorageUnitPriceHistory.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            StorageUnitPriceHistoryResponse mockResponse = StorageUnitPriceHistoryResponse.builder()
                    .storageUnitId(unitId)
                    .oldPrice(new BigDecimal("1000000.00"))
                    .newPrice(new BigDecimal("1250000.00"))
                    .reason(request.getReason())
                    .changedByName(managerUser.getFullName())
                    .build();
            when(storageUnitPriceHistoryMapper.toResponse(any(StorageUnitPriceHistory.class))).thenReturn(mockResponse);

            // Act
            StorageUnitPriceHistoryResponse response = storageUnitPriceHistoryService.adjustUnitPrice(unitId, request);

            // Assert
            assertThat(response).isNotNull();
            assertThat(response.getNewPrice()).isEqualByComparingTo("1250000.00");
            assertThat(response.getOldPrice()).isEqualByComparingTo("1000000.00");
            assertThat(storageUnit.getPricePerMonth()).isEqualByComparingTo("1250000.00");

            verify(facilityAccessGuard).checkFacilityAccess(facility.getId());
            verify(storageUnitPriceHistoryRepository).save(any(StorageUnitPriceHistory.class));
            verify(storageUnitRepository).save(storageUnit);
            verify(activityLogService).record(eq(facility.getId()), eq(ActivityAction.PRICE_UPDATE),
                    eq("STORAGE_UNIT"), eq(unitId), anyString(), any(), any());
        }

        @Test
        @DisplayName("BR-RULE-011.4: Thất bại khi newPrice <= 0")
        void adjustUnitPrice_ZeroOrNegativePrice_ThrowsException() {
            StorageUnitPriceAdjustmentRequest request = StorageUnitPriceAdjustmentRequest.builder()
                    .newPrice(BigDecimal.ZERO)
                    .reason("Lý do hợp lệ")
                    .build();

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(storageUnit));
            when(requestContext.currentUserRole()).thenReturn("BUSINESS_MANAGER");
            when(requestContext.currentUserId()).thenReturn(managerUser.getId());
            when(userRepository.findById(managerUser.getId())).thenReturn(Optional.of(managerUser));

            AppException ex = assertThrows(AppException.class, () ->
                    storageUnitPriceHistoryService.adjustUnitPrice(unitId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PRICE_MUST_BE_GREATER_THAN_ZERO);
            verify(storageUnitPriceHistoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("BR-RULE-011.4: Thất bại khi newPrice trùng với giá hiện tại")
        void adjustUnitPrice_SamePrice_ThrowsException() {
            StorageUnitPriceAdjustmentRequest request = StorageUnitPriceAdjustmentRequest.builder()
                    .newPrice(new BigDecimal("1000000.00"))
                    .reason("Không thay đổi giá")
                    .build();

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(storageUnit));
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(requestContext.currentUserId()).thenReturn(managerUser.getId());
            when(userRepository.findById(managerUser.getId())).thenReturn(Optional.of(managerUser));

            AppException ex = assertThrows(AppException.class, () ->
                    storageUnitPriceHistoryService.adjustUnitPrice(unitId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PRICE_UNCHANGED);
            verify(storageUnitPriceHistoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("BR-RULE-011.4: Thất bại khi không có lý do điều chỉnh giá")
        void adjustUnitPrice_BlankReason_ThrowsException() {
            StorageUnitPriceAdjustmentRequest request = StorageUnitPriceAdjustmentRequest.builder()
                    .newPrice(new BigDecimal("1500000.00"))
                    .reason("   ")
                    .build();

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(storageUnit));
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(requestContext.currentUserId()).thenReturn(managerUser.getId());
            when(userRepository.findById(managerUser.getId())).thenReturn(Optional.of(managerUser));

            AppException ex = assertThrows(AppException.class, () ->
                    storageUnitPriceHistoryService.adjustUnitPrice(unitId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PRICE_ADJUSTMENT_REASON_REQUIRED);
            verify(storageUnitPriceHistoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("BR-RULE-011.3: Thất bại khi Role không có quyền điều chỉnh giá (CUSTOMER)")
        void adjustUnitPrice_UnauthorizedRole_ThrowsForbidden() {
            StorageUnitPriceAdjustmentRequest request = StorageUnitPriceAdjustmentRequest.builder()
                    .newPrice(new BigDecimal("1500000.00"))
                    .reason("Khách hàng thử đổi giá")
                    .build();

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(storageUnit));
            when(requestContext.currentUserRole()).thenReturn("CUSTOMER");

            AppException ex = assertThrows(AppException.class, () ->
                    storageUnitPriceHistoryService.adjustUnitPrice(unitId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FORBIDDEN);
            verify(storageUnitPriceHistoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("BR-RULE-011.4: Thất bại khi ngày hiệu lực quá xa trong quá khứ")
        void adjustUnitPrice_InvalidPastEffectiveDate_ThrowsException() {
            StorageUnitPriceAdjustmentRequest request = StorageUnitPriceAdjustmentRequest.builder()
                    .newPrice(new BigDecimal("1500000.00"))
                    .reason("Áp dụng lùi ngày sâu")
                    .effectiveFrom(LocalDateTime.now().minusDays(5))
                    .build();

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(storageUnit));
            when(requestContext.currentUserRole()).thenReturn("ADMIN");
            when(requestContext.currentUserId()).thenReturn(managerUser.getId());
            when(userRepository.findById(managerUser.getId())).thenReturn(Optional.of(managerUser));

            AppException ex = assertThrows(AppException.class, () ->
                    storageUnitPriceHistoryService.adjustUnitPrice(unitId, request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.PRICE_EFFECTIVE_DATE_INVALID);
            verify(storageUnitPriceHistoryRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Lấy lịch sử giá và Grandfathering helper")
    class PriceHistoryQueryTests {

        @Test
        @DisplayName("Lấy lịch sử giá theo Unit ID")
        void getPriceHistoryByUnit_Success() {
            StorageUnitPriceHistory history = StorageUnitPriceHistory.builder()
                    .storageUnit(storageUnit)
                    .unitType(unitType)
                    .oldPrice(new BigDecimal("1000000.00"))
                    .newPrice(new BigDecimal("1200000.00"))
                    .effectiveFrom(LocalDateTime.now())
                    .reason("Tăng giá")
                    .changedBy(managerUser)
                    .build();

            when(storageUnitRepository.findWithDetailsById(unitId)).thenReturn(Optional.of(storageUnit));
            when(storageUnitPriceHistoryRepository.findByStorageUnit_IdOrderByEffectiveFromDescCreatedAtDesc(unitId))
                    .thenReturn(List.of(history));
            when(storageUnitPriceHistoryMapper.toResponse(history))
                    .thenReturn(StorageUnitPriceHistoryResponse.builder().newPrice(new BigDecimal("1200000.00")).build());

            List<StorageUnitPriceHistoryResponse> result = storageUnitPriceHistoryService.getPriceHistoryByUnit(unitId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getNewPrice()).isEqualByComparingTo("1200000.00");
        }

        @Test
        @DisplayName("BR-RULE-011.2: Lấy giá có hiệu lực theo mốc thời gian")
        void getEffectivePrice_ReturnsHistoricalPrice() {
            LocalDateTime queryTime = LocalDateTime.now();
            StorageUnitPriceHistory history = StorageUnitPriceHistory.builder()
                    .newPrice(new BigDecimal("1150000.00"))
                    .build();

            when(storageUnitPriceHistoryRepository.findEffectivePriceHistory(unitId, queryTime))
                    .thenReturn(List.of(history));

            BigDecimal effectivePrice = storageUnitPriceHistoryService.getEffectivePrice(unitId, queryTime);

            assertThat(effectivePrice).isEqualByComparingTo("1150000.00");
        }
    }
}

