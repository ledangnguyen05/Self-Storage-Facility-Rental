package com.boxora.service.impl;

import com.boxora.dto.request.DiscountCreateRequest;
import com.boxora.dto.request.DiscountUpdateRequest;
import com.boxora.dto.request.DiscountValidateRequest;
import com.boxora.dto.response.DiscountResponse;
import com.boxora.dto.response.DiscountValidateResponse;
import com.boxora.entity.Discount;
import com.boxora.entity.Facility;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.DiscountType;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.DiscountMapper;
import com.boxora.repository.DiscountRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.service.ActivityLogService;
import com.boxora.service.DiscountService;
import com.boxora.util.VndFormat;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DiscountServiceImpl implements DiscountService {

    private final DiscountRepository discountRepository;
    private final FacilityRepository facilityRepository;
    private final DiscountMapper discountMapper;
    private final ActivityLogService activityLogService;

    @Override
    @Transactional(readOnly = true)
    public List<DiscountResponse> getAllDiscounts(UUID facilityId, Boolean activeOnly) {
        log.info("Fetching discounts with facilityId={}, activeOnly={}", facilityId, activeOnly);
        boolean onlyActive = Boolean.TRUE.equals(activeOnly);

        List<Discount> list = discountRepository.findAll();

        if (onlyActive) {
            list = list.stream().filter(d -> Boolean.TRUE.equals(d.getIsActive())).toList();
        }

        if (facilityId != null) {
            list = list.stream().filter(d -> d.getFacility() == null || d.getFacility().getId().equals(facilityId)).toList();
        }

        return list.stream().map(discountMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DiscountResponse> getActiveDiscounts(UUID facilityId) {
        LocalDate today = LocalDate.now();
        List<Discount> list = discountRepository.findActiveDiscounts(today, facilityId);
        return list.stream().map(discountMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DiscountResponse getDiscountById(UUID id) {
        Discount discount = discountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_NOT_FOUND));
        return discountMapper.toResponse(discount);
    }

    @Override
    @Transactional(readOnly = true)
    public DiscountResponse getDiscountByCode(String code) {
        Discount discount = discountRepository.findByCode(code.trim().toUpperCase())
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_NOT_FOUND));
        return discountMapper.toResponse(discount);
    }

    @Override
    @Transactional
    public DiscountResponse createDiscount(DiscountCreateRequest request) {
        String code = request.getCode().trim().toUpperCase();
        log.info("Creating discount with code={}", code);

        if (discountRepository.existsByCode(code)) {
            throw new AppException(ErrorCode.DISCOUNT_CODE_EXISTS);
        }

        if (request.getEndDate() != null && request.getEndDate().isBefore(request.getStartDate())) {
            throw new AppException(ErrorCode.DISCOUNT_DATE_INVALID);
        }

        if (request.getDiscountType() == DiscountType.PERCENTAGE) {
            if (request.getDiscountValue().compareTo(BigDecimal.ZERO) <= 0
                    || request.getDiscountValue().compareTo(new BigDecimal("100.00")) > 0) {
                throw new AppException(ErrorCode.DISCOUNT_VALUE_INVALID);
            }
        }

        Facility facility = null;
        if (request.getFacilityId() != null) {
            facility = facilityRepository.findById(request.getFacilityId())
                    .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
        }

        Discount discount = discountMapper.toEntity(request);
        discount.setCode(code);
        discount.setFacility(facility);
        if (discount.getUsedCount() == null) {
            discount.setUsedCount(0);
        }
        if (discount.getIsActive() == null) {
            discount.setIsActive(true);
        }
        if (discount.getMinRentalMonths() == null || discount.getMinRentalMonths() < 1) {
            discount.setMinRentalMonths(1);
        }

        Discount saved = discountRepository.save(discount);

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.DISCOUNT_CREATE,
                "Discount",
                saved.getId(),
                String.format("Tạo chương trình ưu đãi %s (%s) - Loại: %s, Giá trị: %s",
                        saved.getName(), saved.getCode(), discountTypeLabel(saved.getDiscountType()), discountValueText(saved)),
                null,
                null
        );

        return discountMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public DiscountResponse updateDiscount(UUID id, DiscountUpdateRequest request) {
        log.info("Updating discount id={}", id);
        Discount discount = discountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_NOT_FOUND));

        if (request.getName() != null && !request.getName().isBlank()) {
            discount.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            discount.setDescription(request.getDescription().trim());
        }
        if (request.getDiscountType() != null) {
            discount.setDiscountType(request.getDiscountType());
        }
        if (request.getDiscountValue() != null) {
            if (discount.getDiscountType() == DiscountType.PERCENTAGE
                    && (request.getDiscountValue().compareTo(BigDecimal.ZERO) <= 0
                    || request.getDiscountValue().compareTo(new BigDecimal("100.00")) > 0)) {
                throw new AppException(ErrorCode.DISCOUNT_VALUE_INVALID);
            }
            discount.setDiscountValue(request.getDiscountValue());
        }
        if (request.getMinRentalMonths() != null) {
            discount.setMinRentalMonths(Math.max(1, request.getMinRentalMonths()));
        }
        if (request.getMaxDiscountAmount() != null) {
            discount.setMaxDiscountAmount(request.getMaxDiscountAmount());
        }
        if (request.getStartDate() != null) {
            discount.setStartDate(request.getStartDate());
        }
        if (request.getEndDate() != null) {
            if (discount.getStartDate() != null && request.getEndDate().isBefore(discount.getStartDate())) {
                throw new AppException(ErrorCode.DISCOUNT_DATE_INVALID);
            }
            discount.setEndDate(request.getEndDate());
        }
        if (request.getUsageLimit() != null) {
            discount.setUsageLimit(request.getUsageLimit());
        }
        if (request.getFacilityId() != null) {
            Facility facility = facilityRepository.findById(request.getFacilityId())
                    .orElseThrow(() -> new AppException(ErrorCode.FACILITY_NOT_FOUND));
            discount.setFacility(facility);
        }
        if (request.getIsActive() != null) {
            discount.setIsActive(request.getIsActive());
        }

        Discount saved = discountRepository.save(discount);

        activityLogService.record(
                saved.getFacility() != null ? saved.getFacility().getId() : null,
                ActivityAction.DISCOUNT_UPDATE,
                "Discount",
                saved.getId(),
                String.format("Cập nhật chương trình ưu đãi %s (%s)", saved.getName(), saved.getCode()),
                null,
                null
        );

        return discountMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public void deleteDiscount(UUID id) {
        log.info("Deactivating discount id={}", id);
        Discount discount = discountRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_NOT_FOUND));

        discount.setIsActive(false);
        discountRepository.save(discount);

        activityLogService.record(
                discount.getFacility() != null ? discount.getFacility().getId() : null,
                ActivityAction.DISCOUNT_DEACTIVATE,
                "Discount",
                discount.getId(),
                String.format("Vô hiệu hóa chương trình ưu đãi %s (%s)", discount.getName(), discount.getCode()),
                null,
                null
        );
    }

    /**
     * Mã sai là lỗi nghiệp vụ (400), không phải lỗi hệ thống. {@code noRollbackFor} giữ giao dịch của người gọi
     * (báo giá, đặt kho) không bị đánh dấu rollback-only khi người gọi tự bắt AppException này.
     */
    @Override
    @Transactional(readOnly = true, noRollbackFor = AppException.class)
    public DiscountValidateResponse validateAndCalculateDiscount(DiscountValidateRequest request) {
        String code = request.getCode().trim().toUpperCase();
        log.info("Validating discount code={} for baseAmount={}, rentalMonths={}",
                code, request.getBaseAmount(), request.getRentalMonths());

        Discount discount = discountRepository.findByCode(code)
                .orElseThrow(() -> new AppException(ErrorCode.DISCOUNT_CODE_INVALID, "Mã ưu đãi không tồn tại"));

        if (Boolean.FALSE.equals(discount.getIsActive())) {
            throw new AppException(ErrorCode.DISCOUNT_EXPIRED);
        }

        LocalDate today = LocalDate.now();
        if (discount.getStartDate() != null && discount.getStartDate().isAfter(today)) {
            throw new AppException(ErrorCode.DISCOUNT_EXPIRED);
        }
        if (discount.getEndDate() != null && discount.getEndDate().isBefore(today)) {
            throw new AppException(ErrorCode.DISCOUNT_EXPIRED);
        }

        if (discount.getUsageLimit() != null && discount.getUsedCount() != null
                && discount.getUsedCount() >= discount.getUsageLimit()) {
            throw new AppException(ErrorCode.DISCOUNT_USAGE_LIMIT_EXCEEDED);
        }

        if (request.getRentalMonths() != null && discount.getMinRentalMonths() != null
                && request.getRentalMonths() < discount.getMinRentalMonths()) {
            throw new AppException(ErrorCode.DISCOUNT_MIN_MONTHS_NOT_MET);
        }

        if (discount.getFacility() != null && request.getFacilityId() != null
                && !discount.getFacility().getId().equals(request.getFacilityId())) {
            throw new AppException(ErrorCode.DISCOUNT_FACILITY_MISMATCH);
        }

        BigDecimal baseAmount = request.getBaseAmount();
        BigDecimal discountAmount = BigDecimal.ZERO;

        if (discount.getDiscountType() == DiscountType.PERCENTAGE) {
            BigDecimal rate = discount.getDiscountValue().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            discountAmount = baseAmount.multiply(rate).setScale(2, RoundingMode.HALF_UP);
            if (discount.getMaxDiscountAmount() != null && discountAmount.compareTo(discount.getMaxDiscountAmount()) > 0) {
                discountAmount = discount.getMaxDiscountAmount();
            }
        } else if (discount.getDiscountType() == DiscountType.FIXED_AMOUNT) {
            discountAmount = discount.getDiscountValue();
            if (discountAmount.compareTo(baseAmount) > 0) {
                discountAmount = baseAmount;
            }
        } else if (discount.getDiscountType() == DiscountType.TENURE_CYCLE) {
            BigDecimal rate = discount.getDiscountValue().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            discountAmount = baseAmount.multiply(rate).setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal finalAmount = baseAmount.subtract(discountAmount);
        if (finalAmount.compareTo(BigDecimal.ZERO) < 0) {
            finalAmount = BigDecimal.ZERO;
        }

        return DiscountValidateResponse.builder()
                .isValid(true)
                .discountId(discount.getId())
                .code(discount.getCode())
                .name(discount.getName())
                .discountType(discount.getDiscountType())
                .discountValue(discount.getDiscountValue())
                .discountAmount(discountAmount)
                .finalAmount(finalAmount)
                .message(String.format("Áp dụng thành công mã ưu đãi '%s'. Giảm %s.", discount.getCode(), VndFormat.format(discountAmount)))
                .build();
    }

    @Override
    @Transactional
    public void consumeDiscount(String code) {
        if (code == null || code.isBlank()) {
            return;
        }
        String normalized = code.trim().toUpperCase();
        // Mã chiết khấu kỳ hạn tự sinh (TERM_xx) không nằm trong bảng ưu đãi nên không đếm lượt dùng.
        if (normalized.startsWith("TERM_")) {
            return;
        }
        if (discountRepository.incrementUsedCount(normalized) == 0) {
            throw new AppException(ErrorCode.DISCOUNT_USAGE_LIMIT_EXCEEDED);
        }
    }

    /** Tên loại ưu đãi cho nhật ký hoạt động (không để lộ mã kỹ thuật như FIXED_AMOUNT). */
    private static String discountTypeLabel(DiscountType type) {
        if (type == null) {
            return "Không xác định";
        }
        return switch (type) {
            case PERCENTAGE -> "Giảm theo phần trăm";
            case FIXED_AMOUNT -> "Giảm số tiền cố định";
            case TENURE_CYCLE -> "Giảm theo kỳ hạn thuê";
        };
    }

    /** Giá trị ưu đãi: "15%" cho loại phần trăm và theo kỳ hạn, "200.000 ₫" cho số tiền cố định. */
    private static String discountValueText(Discount discount) {
        BigDecimal value = discount.getDiscountValue();
        if (value == null) {
            return "—";
        }
        if (discount.getDiscountType() == DiscountType.FIXED_AMOUNT) {
            return VndFormat.format(value);
        }
        return value.stripTrailingZeros().toPlainString() + "%";
    }
}
