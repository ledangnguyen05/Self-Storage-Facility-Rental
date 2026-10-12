package com.boxora.service;

import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.UnitTypeResponse;
import com.boxora.entity.StorageUnitPriceHistory;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;
import com.boxora.repository.StorageUnitPriceHistoryRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UnitTypeRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.impl.UnitTypeServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UnitTypeServiceTest {

    @Mock
    private UnitTypeRepository unitTypeRepository;

    @Mock
    private StorageUnitPriceHistoryRepository priceHistoryRepository;

    @Mock
    private StorageUnitRepository storageUnitRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ActivityLogService activityLogService;

    @InjectMocks
    private UnitTypeServiceImpl unitTypeService;

    private UnitType sampleUnitType;
    private User testUser;
    private UUID unitTypeId;

    @BeforeEach
    void setUp() {
        unitTypeId = UUID.randomUUID();
        sampleUnitType = UnitType.builder()
                .typeName("Standard Storage")
                .dimensions("2.0m x 3.0m x 2.8m")
                .areaSqm(6.0)
                .basePricePerMonth(new BigDecimal("1500000.00"))
                .depositAmount(new BigDecimal("1500000.00"))
                .build();
        sampleUnitType.setId(unitTypeId);

        testUser = User.builder()
                .email("business@gmail.com")
                .fullName("Business Manager")
                .build();
        testUser.setId(UUID.randomUUID());
    }

    @Test
    @DisplayName("createUnitType should save unit type and seed initial price history entry")
    void testCreateUnitType() {
        UnitTypeCreateRequest request = UnitTypeCreateRequest.builder()
                .typeName("Locker Mini")
                .dimensions("1.0m x 1.0m x 1.2m")
                .areaSqm(1.0)
                .basePricePerMonth(new BigDecimal("500000.00"))
                .depositAmount(new BigDecimal("500000.00"))
                .build();

        when(userRepository.findByEmail("business@gmail.com")).thenReturn(Optional.of(testUser));
        when(unitTypeRepository.save(any(UnitType.class))).thenAnswer(invocation -> {
            UnitType ut = invocation.getArgument(0);
            ut.setId(UUID.randomUUID());
            return ut;
        });

        UnitTypeResponse response = unitTypeService.createUnitType(request, "business@gmail.com");

        assertThat(response).isNotNull();
        assertThat(response.getTypeName()).isEqualTo("Locker Mini");
        assertThat(response.getBasePricePerMonth()).isEqualByComparingTo("500000.00");

        verify(priceHistoryRepository, times(1)).save(any(StorageUnitPriceHistory.class));
    }

    @Test
    @DisplayName("updateUnitType with new price should trigger BR-RULE-011 price history recording")
    void testUpdateUnitPriceHistoryUnderBrRule011() {
        BigDecimal oldPrice = new BigDecimal("1500000.00");
        BigDecimal newPrice = new BigDecimal("1850000.00");

        StorageUnitPriceHistory activeHistory = StorageUnitPriceHistory.builder()
                .unitType(sampleUnitType)
                .oldPrice(oldPrice)
                .newPrice(oldPrice)
                .effectiveFrom(LocalDateTime.now().minusDays(30))
                .effectiveTo(null)
                .reason("Initial price")
                .build();

        UnitTypeUpdateRequest request = UnitTypeUpdateRequest.builder()
                .basePricePerMonth(newPrice)
                .changeReason("Điều chỉnh theo trượt giá Q4/2026")
                .build();

        when(unitTypeRepository.findById(unitTypeId)).thenReturn(Optional.of(sampleUnitType));
        when(userRepository.findByEmail("business@gmail.com")).thenReturn(Optional.of(testUser));
        when(priceHistoryRepository.findFirstByUnitType_IdAndEffectiveToIsNullOrderByEffectiveFromDesc(unitTypeId))
                .thenReturn(Optional.of(activeHistory));
        when(unitTypeRepository.save(any(UnitType.class))).thenReturn(sampleUnitType);

        UnitTypeResponse response = unitTypeService.updateUnitType(unitTypeId, request, "business@gmail.com");

        assertThat(response).isNotNull();

        // 1. Verify previous active price was closed
        assertThat(activeHistory.getEffectiveTo()).isNotNull();

        // 2. Verify new price history was saved with new price
        ArgumentCaptor<StorageUnitPriceHistory> historyCaptor = ArgumentCaptor.forClass(StorageUnitPriceHistory.class);
        verify(priceHistoryRepository, times(2)).save(historyCaptor.capture());

        StorageUnitPriceHistory newEntry = historyCaptor.getAllValues().get(1);
        assertThat(newEntry.getOldPrice()).isEqualByComparingTo(oldPrice);
        assertThat(newEntry.getNewPrice()).isEqualByComparingTo(newPrice);
        assertThat(newEntry.getEffectiveTo()).isNull();
        assertThat(newEntry.getReason()).isEqualTo("Điều chỉnh theo trượt giá Q4/2026");
        assertThat(newEntry.getChangedBy()).isEqualTo(testUser);
    }
}
