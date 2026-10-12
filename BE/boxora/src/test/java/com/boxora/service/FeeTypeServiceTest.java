package com.boxora.service;

import com.boxora.dto.request.FeeTypeCreateRequest;
import com.boxora.dto.request.FeeTypeUpdateRequest;
import com.boxora.dto.response.FeeTypeResponse;
import com.boxora.entity.FeeType;
import com.boxora.enums.FeeCategory;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.FeeTypeMapper;
import com.boxora.repository.FeeTypeRepository;
import com.boxora.service.impl.FeeTypeServiceImpl;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeeTypeServiceTest {

    @Mock
    private FeeTypeRepository feeTypeRepository;

    @Mock
    private FeeTypeMapper feeTypeMapper;

    @Mock
    private ActivityLogService activityLogService;

    @InjectMocks
    private FeeTypeServiceImpl feeTypeService;

    private FeeType testFee;
    private FeeTypeResponse testResponse;
    private UUID feeId;

    @BeforeEach
    void setUp() {
        feeId = UUID.randomUUID();
        testFee = FeeType.builder()
                .code("CLEANING_BASIC")
                .name("Phí vệ sinh khử khuẩn")
                .description("Vệ sinh kho sau khi trả")
                .defaultAmount(new BigDecimal("150000.00"))
                .feeCategory(FeeCategory.CLEANING)
                .isRecurring(false)
                .isActive(true)
                .build();
        testFee.setId(feeId);

        testResponse = FeeTypeResponse.builder()
                .id(feeId)
                .code("CLEANING_BASIC")
                .name("Phí vệ sinh khử khuẩn")
                .defaultAmount(new BigDecimal("150000.00"))
                .feeCategory(FeeCategory.CLEANING)
                .isActive(true)
                .build();
    }

    @Nested
    @DisplayName("Query tests")
    class QueryTests {

        @Test
        @DisplayName("Lấy danh sách tất cả các loại phí")
        void testGetAllFeeTypes() {
            when(feeTypeRepository.findAll()).thenReturn(List.of(testFee));
            when(feeTypeMapper.toResponse(testFee)).thenReturn(testResponse);

            List<FeeTypeResponse> result = feeTypeService.getAllFeeTypes(null, false);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getCode()).isEqualTo("CLEANING_BASIC");
        }

        @Test
        @DisplayName("Lấy danh sách chỉ các loại phí đang hoạt động")
        void testGetAllFeeTypes_ActiveOnly() {
            when(feeTypeRepository.findByIsActiveTrue()).thenReturn(List.of(testFee));
            when(feeTypeMapper.toResponse(testFee)).thenReturn(testResponse);

            List<FeeTypeResponse> result = feeTypeService.getAllFeeTypes(null, true);

            assertThat(result).hasSize(1);
            verify(feeTypeRepository).findByIsActiveTrue();
        }

        @Test
        @DisplayName("Lấy loại phí theo ID thành công")
        void testGetFeeTypeById_Success() {
            when(feeTypeRepository.findById(feeId)).thenReturn(Optional.of(testFee));
            when(feeTypeMapper.toResponse(testFee)).thenReturn(testResponse);

            FeeTypeResponse result = feeTypeService.getFeeTypeById(feeId);

            assertThat(result).isNotNull();
            assertThat(result.getId()).isEqualTo(feeId);
        }

        @Test
        @DisplayName("Lấy loại phí theo ID thất bại: Ném FEE_TYPE_NOT_FOUND")
        void testGetFeeTypeById_NotFound() {
            when(feeTypeRepository.findById(feeId)).thenReturn(Optional.empty());

            AppException ex = assertThrows(AppException.class, () ->
                    feeTypeService.getFeeTypeById(feeId));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FEE_TYPE_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("Create tests")
    class CreateTests {

        @Test
        @DisplayName("Tạo mới loại phí thành công")
        void testCreateFeeType_Success() {
            FeeTypeCreateRequest request = FeeTypeCreateRequest.builder()
                    .code("KEY_REPLACE")
                    .name("Phí cấp lại chìa SmartLock")
                    .defaultAmount(new BigDecimal("200000.00"))
                    .feeCategory(FeeCategory.KEY_REPLACEMENT)
                    .build();

            when(feeTypeRepository.existsByCode("KEY_REPLACE")).thenReturn(false);
            when(feeTypeMapper.toEntity(request)).thenReturn(testFee);
            when(feeTypeRepository.save(any(FeeType.class))).thenReturn(testFee);
            when(feeTypeMapper.toResponse(testFee)).thenReturn(testResponse);

            FeeTypeResponse result = feeTypeService.createFeeType(request);

            assertThat(result).isNotNull();
            verify(feeTypeRepository).save(any(FeeType.class));
            verify(activityLogService).record(any(), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("Tạo mới loại phí thất bại: Mã đã tồn tại ném FEE_TYPE_CODE_EXISTS")
        void testCreateFeeType_CodeExists() {
            FeeTypeCreateRequest request = FeeTypeCreateRequest.builder()
                    .code("CLEANING_BASIC")
                    .name("Phí vệ sinh trùng")
                    .defaultAmount(new BigDecimal("100000.00"))
                    .feeCategory(FeeCategory.CLEANING)
                    .build();

            when(feeTypeRepository.existsByCode("CLEANING_BASIC")).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () ->
                    feeTypeService.createFeeType(request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.FEE_TYPE_CODE_EXISTS);
            verify(feeTypeRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("Update & Delete tests")
    class UpdateDeleteTests {

        @Test
        @DisplayName("Cập nhật loại phí thành công")
        void testUpdateFeeType_Success() {
            FeeTypeUpdateRequest request = FeeTypeUpdateRequest.builder()
                    .name("Phí vệ sinh chuyên sâu")
                    .defaultAmount(new BigDecimal("250000.00"))
                    .build();

            when(feeTypeRepository.findById(feeId)).thenReturn(Optional.of(testFee));
            when(feeTypeRepository.save(any(FeeType.class))).thenReturn(testFee);
            when(feeTypeMapper.toResponse(testFee)).thenReturn(testResponse);

            FeeTypeResponse result = feeTypeService.updateFeeType(feeId, request);

            assertThat(result).isNotNull();
            verify(feeTypeRepository).save(testFee);
        }

        @Test
        @DisplayName("Xóa mềm (vô hiệu hóa) loại phí thành công")
        void testDeleteFeeType_Success() {
            when(feeTypeRepository.findById(feeId)).thenReturn(Optional.of(testFee));
            when(feeTypeRepository.save(any(FeeType.class))).thenReturn(testFee);

            feeTypeService.deleteFeeType(feeId);

            assertThat(testFee.getIsActive()).isFalse();
            verify(feeTypeRepository).save(testFee);
        }
    }
}
