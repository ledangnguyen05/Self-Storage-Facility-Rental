package com.boxora.service;

import com.boxora.dto.request.DiscountCreateRequest;
import com.boxora.dto.request.DiscountUpdateRequest;
import com.boxora.dto.request.DiscountValidateRequest;
import com.boxora.dto.response.DiscountResponse;
import com.boxora.dto.response.DiscountValidateResponse;
import com.boxora.entity.Discount;
import com.boxora.entity.Facility;
import com.boxora.enums.DiscountType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.DiscountMapper;
import com.boxora.repository.DiscountRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.service.impl.DiscountServiceImpl;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DiscountServiceTest {

    @Mock
    private DiscountRepository discountRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private DiscountMapper discountMapper;

    @Mock
    private ActivityLogService activityLogService;

    @InjectMocks
    private DiscountServiceImpl discountService;

    private Discount testDiscount;
    private DiscountResponse testResponse;
    private UUID discountId;

    @BeforeEach
    void setUp() {
        discountId = UUID.randomUUID();
        testDiscount = Discount.builder()
                .code("SUMMER2026")
                .name("Ưu đãi mùa hè 15%")
                .description("Giảm 15% cho hợp đồng từ 3 tháng")
                .discountType(DiscountType.PERCENTAGE)
                .discountValue(new BigDecimal("15.00"))
                .minRentalMonths(3)
                .maxDiscountAmount(new BigDecimal("500000.00"))
                .startDate(LocalDate.now().minusDays(5))
                .endDate(LocalDate.now().plusDays(30))
                .usageLimit(100)
                .usedCount(10)
                .isActive(true)
                .build();
        testDiscount.setId(discountId);

        testResponse = DiscountResponse.builder()
                .id(discountId)
                .code("SUMMER2026")
                .name("Ưu đãi mùa hè 15%")
                .discountType(DiscountType.PERCENTAGE)
                .discountValue(new BigDecimal("15.00"))
                .isActive(true)
                .isCurrentlyValid(true)
                .build();
    }

    @Nested
    @DisplayName("Query tests")
    class QueryTests {

        @Test
        @DisplayName("Lấy danh sách tất cả các ưu đãi")
        void testGetAllDiscounts() {
            when(discountRepository.findAll()).thenReturn(List.of(testDiscount));
            when(discountMapper.toResponse(testDiscount)).thenReturn(testResponse);

            List<DiscountResponse> result = discountService.getAllDiscounts(null, false);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getCode()).isEqualTo("SUMMER2026");
        }

        @Test
        @DisplayName("Lấy chi tiết ưu đãi theo ID thành công")
        void testGetDiscountById_Success() {
            when(discountRepository.findById(discountId)).thenReturn(Optional.of(testDiscount));
            when(discountMapper.toResponse(testDiscount)).thenReturn(testResponse);

            DiscountResponse result = discountService.getDiscountById(discountId);

            assertThat(result).isNotNull();
            assertThat(result.getId()).isEqualTo(discountId);
        }

        @Test
        @DisplayName("Lấy chi tiết ưu đãi thất bại: Ném DISCOUNT_NOT_FOUND")
        void testGetDiscountById_NotFound() {
            when(discountRepository.findById(discountId)).thenReturn(Optional.empty());

            AppException ex = assertThrows(AppException.class, () ->
                    discountService.getDiscountById(discountId));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.DISCOUNT_NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("Create & Update tests")
    class CreateUpdateTests {

        @Test
        @DisplayName("Tạo mới ưu đãi thành công")
        void testCreateDiscount_Success() {
            DiscountCreateRequest request = DiscountCreateRequest.builder()
                    .code("WELCOME")
                    .name("Chào mừng bạn mới")
                    .discountType(DiscountType.FIXED_AMOUNT)
                    .discountValue(new BigDecimal("100000.00"))
                    .startDate(LocalDate.now())
                    .build();

            when(discountRepository.existsByCode("WELCOME")).thenReturn(false);
            when(discountMapper.toEntity(request)).thenReturn(testDiscount);
            when(discountRepository.save(any(Discount.class))).thenReturn(testDiscount);
            when(discountMapper.toResponse(testDiscount)).thenReturn(testResponse);

            DiscountResponse result = discountService.createDiscount(request);

            assertThat(result).isNotNull();
            verify(discountRepository).save(any(Discount.class));
        }

        @Test
        @DisplayName("Tạo mới ưu đãi thất bại: Mã đã tồn tại ném DISCOUNT_CODE_EXISTS")
        void testCreateDiscount_CodeExists() {
            DiscountCreateRequest request = DiscountCreateRequest.builder()
                    .code("SUMMER2026")
                    .name("Trùng mã")
                    .discountType(DiscountType.PERCENTAGE)
                    .discountValue(new BigDecimal("10.00"))
                    .startDate(LocalDate.now())
                    .build();

            when(discountRepository.existsByCode("SUMMER2026")).thenReturn(true);

            AppException ex = assertThrows(AppException.class, () ->
                    discountService.createDiscount(request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.DISCOUNT_CODE_EXISTS);
            verify(discountRepository, never()).save(any());
        }

        @Test
        @DisplayName("Cập nhật ưu đãi thành công")
        void testUpdateDiscount_Success() {
            DiscountUpdateRequest request = DiscountUpdateRequest.builder()
                    .name("Ưu đãi hè đặc biệt 20%")
                    .discountValue(new BigDecimal("20.00"))
                    .build();

            when(discountRepository.findById(discountId)).thenReturn(Optional.of(testDiscount));
            when(discountRepository.save(any(Discount.class))).thenReturn(testDiscount);
            when(discountMapper.toResponse(testDiscount)).thenReturn(testResponse);

            DiscountResponse result = discountService.updateDiscount(discountId, request);

            assertThat(result).isNotNull();
            verify(discountRepository).save(testDiscount);
        }
    }

    @Nested
    @DisplayName("Validate & Calculate tests")
    class ValidateTests {

        @Test
        @DisplayName("Xác thực mã voucher thành công: Tính đúng số tiền giảm và trần maxDiscountAmount")
        void testValidateDiscount_Success() {
            DiscountValidateRequest request = DiscountValidateRequest.builder()
                    .code("SUMMER2026")
                    .rentalMonths(6)
                    .baseAmount(new BigDecimal("6000000.00")) // 15% của 6tr = 900k, nhưng trần là 500k
                    .build();

            when(discountRepository.findByCode("SUMMER2026")).thenReturn(Optional.of(testDiscount));

            DiscountValidateResponse response = discountService.validateAndCalculateDiscount(request);

            assertThat(response.getIsValid()).isTrue();
            // Bị chặn trần 500k
            assertThat(response.getDiscountAmount()).isEqualByComparingTo("500000.00");
            assertThat(response.getFinalAmount()).isEqualByComparingTo("5500000.00");
            // The message reads Vietnamese-style ("500.000 ₫"), never "500000.00 VNĐ"
            assertThat(response.getMessage()).contains("500.000 ₫").doesNotContain("VNĐ").doesNotContain("500000");
        }

        @Test
        @DisplayName("Xác thực voucher thất bại: Hết hạn ném DISCOUNT_EXPIRED")
        void testValidateDiscount_Expired() {
            testDiscount.setEndDate(LocalDate.now().minusDays(1)); // Đã hết hạn

            DiscountValidateRequest request = DiscountValidateRequest.builder()
                    .code("SUMMER2026")
                    .rentalMonths(3)
                    .baseAmount(new BigDecimal("3000000.00"))
                    .build();

            when(discountRepository.findByCode("SUMMER2026")).thenReturn(Optional.of(testDiscount));

            AppException ex = assertThrows(AppException.class, () ->
                    discountService.validateAndCalculateDiscount(request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.DISCOUNT_EXPIRED);
        }

        @Test
        @DisplayName("Xác thực voucher thất bại: Không đủ số tháng tối thiểu ném DISCOUNT_MIN_MONTHS_NOT_MET")
        void testValidateDiscount_MinMonthsNotMet() {
            DiscountValidateRequest request = DiscountValidateRequest.builder()
                    .code("SUMMER2026")
                    .rentalMonths(1) // Cần tối thiểu 3 tháng
                    .baseAmount(new BigDecimal("1000000.00"))
                    .build();

            when(discountRepository.findByCode("SUMMER2026")).thenReturn(Optional.of(testDiscount));

            AppException ex = assertThrows(AppException.class, () ->
                    discountService.validateAndCalculateDiscount(request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.DISCOUNT_MIN_MONTHS_NOT_MET);
        }

        @Test
        @DisplayName("Xác thực voucher thất bại: Vượt quá số lượt sử dụng ném DISCOUNT_USAGE_LIMIT_EXCEEDED")
        void testValidateDiscount_UsageLimitExceeded() {
            testDiscount.setUsedCount(100);
            testDiscount.setUsageLimit(100); // Đã hết lượt

            DiscountValidateRequest request = DiscountValidateRequest.builder()
                    .code("SUMMER2026")
                    .rentalMonths(4)
                    .baseAmount(new BigDecimal("4000000.00"))
                    .build();

            when(discountRepository.findByCode("SUMMER2026")).thenReturn(Optional.of(testDiscount));

            AppException ex = assertThrows(AppException.class, () ->
                    discountService.validateAndCalculateDiscount(request));

            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.DISCOUNT_USAGE_LIMIT_EXCEEDED);
        }
    }
}

