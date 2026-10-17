package com.boxora.service.impl;

import com.boxora.dto.request.DiscountValidateRequest;
import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.DiscountValidateResponse;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.StorageUnit;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.service.DiscountService;
import com.boxora.service.PricingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

@Service
@Slf4j
public class PricingServiceImpl implements PricingService {

    private final StorageUnitRepository storageUnitRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final DiscountService discountService;

    public PricingServiceImpl(StorageUnitRepository storageUnitRepository,
                              FacilityPolicyRepository facilityPolicyRepository,
                              DiscountService discountService) {
        this.storageUnitRepository = storageUnitRepository;
        this.facilityPolicyRepository = facilityPolicyRepository;
        this.discountService = discountService;
    }

    @Override
    @Transactional(readOnly = true)
    public PricingQuoteResponse calculateQuote(PricingQuoteRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(request.getStorageUnitId())
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        Facility facility = unit.getFacility();
        FacilityPolicy policy = (facility != null)
                ? facilityPolicyRepository.findByFacilityId(facility.getId()).orElse(null)
                : null;

        int months = (request.getRentalMonths() != null && request.getRentalMonths() >= 1)
                ? request.getRentalMonths()
                : 1;

        if (policy != null && policy.getMinimumRentalMonths() != null && months < policy.getMinimumRentalMonths()) {
            throw new AppException(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID);
        }

        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();
        LocalDate endDate = startDate.plusMonths(months);

        // 1. Đơn giá thuê hàng tháng (Monthly Rate)
        BigDecimal monthlyRate = unit.getEffectiveBasePrice();
        if (monthlyRate == null || monthlyRate.compareTo(BigDecimal.ZERO) <= 0) {
            if (unit.getUnitType() != null && unit.getUnitType().getBasePricePerMonth() != null) {
                monthlyRate = unit.getUnitType().getBasePricePerMonth();
            } else {
                monthlyRate = new BigDecimal("1450000.00");
            }
        }

        // 2. Tổng cước thuê chưa giảm trừ
        BigDecimal subtotal = monthlyRate.multiply(BigDecimal.valueOf(months));

        // 3. Xử lý mã giảm giá / chiết khấu
        String appliedDiscountCode = null;
        Integer discountPct = null;
        BigDecimal discountAmount = BigDecimal.ZERO;

        if (request.getDiscountCode() != null && !request.getDiscountCode().trim().isEmpty()) {
            try {
                DiscountValidateRequest valReq = DiscountValidateRequest.builder()
                        .code(request.getDiscountCode().trim())
                        .facilityId(facility != null ? facility.getId() : null)
                        .rentalMonths(months)
                        .baseAmount(subtotal)
                        .build();
                DiscountValidateResponse valRes = discountService.validateAndCalculateDiscount(valReq);
                if (Boolean.TRUE.equals(valRes.getIsValid()) && valRes.getDiscountAmount() != null) {
                    appliedDiscountCode = valRes.getCode();
                    discountAmount = valRes.getDiscountAmount();
                    if (valRes.getDiscountValue() != null && subtotal.compareTo(BigDecimal.ZERO) > 0) {
                        discountPct = valRes.getDiscountValue().intValue();
                    }
                }
            } catch (Exception ex) {
                log.warn("Failed to apply discount code {}: {}", request.getDiscountCode(), ex.getMessage());
            }
        }

        // Tự động áp dụng chiết khấu theo kỳ hạn thuê nếu chưa có mã giảm giá hoặc chiết khấu kỳ hạn cao hơn
        int termDiscountPct = 0;
        if (months >= 24) {
            termDiscountPct = 20;
        } else if (months >= 12) {
            termDiscountPct = 15;
        } else if (months >= 6) {
            termDiscountPct = 10;
        } else if (months >= 3) {
            termDiscountPct = 5;
        }

        if (termDiscountPct > 0) {
            BigDecimal termDiscountAmount = subtotal.multiply(BigDecimal.valueOf(termDiscountPct))
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            if (termDiscountAmount.compareTo(discountAmount) > 0) {
                discountPct = termDiscountPct;
                discountAmount = termDiscountAmount;
                if (appliedDiscountCode == null) {
                    appliedDiscountCode = "TERM_" + termDiscountPct + "PCT";
                }
            }
        }

        BigDecimal totalRentalFee = subtotal.subtract(discountAmount);
        if (totalRentalFee.compareTo(BigDecimal.ZERO) < 0) {
            totalRentalFee = BigDecimal.ZERO;
        }

        // 4. Tiền cọc (Theo SRS Boxora: bằng 1 tháng tiền thuê niêm yết)
        BigDecimal depositAmount = (unit.getUnitType() != null && unit.getUnitType().getDepositAmount() != null
                && unit.getUnitType().getDepositAmount().compareTo(BigDecimal.ZERO) > 0)
                ? unit.getUnitType().getDepositAmount()
                : monthlyRate;

        // 5. Khoản thanh toán ban đầu (Tháng đầu + Tiền cọc)
        BigDecimal firstMonthRent = totalRentalFee.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
        BigDecimal initialPayment = firstMonthRent.add(depositAmount);

        // 6. Tổng giá trị hợp đồng
        BigDecimal totalContractValue = totalRentalFee.add(depositAmount);

        int slaDays = (policy != null && policy.getDepositRefundSlaDays() != null)
                ? policy.getDepositRefundSlaDays()
                : 5;

        int holdGraceHours = (policy != null && policy.getHoldGraceHours() != null)
                ? policy.getHoldGraceHours()
                : 24;

        int maxHoldDays = (policy != null && policy.getMaxHoldDays() != null)
                ? policy.getMaxHoldDays()
                : 14;

        String cancellationPolicy = "Giữ chỗ miễn phí theo lịch hẹn được bảo lưu đến giờ hẹn cộng thêm " + holdGraceHours + " giờ theo chính sách cơ sở. " +
                "Sau khi nhận kho, quy trình hoàn cọc được thẩm định hiện trường và thanh toán trong 3-5 ngày làm việc.";

        return PricingQuoteResponse.builder()
                .storageUnitId(unit.getId())
                .unitCode(unit.getUnitCode())
                .unitTypeName(unit.getUnitType() != null ? unit.getUnitType().getTypeName() : "Standard")
                .facilityId(facility != null ? facility.getId() : null)
                .facilityName(facility != null ? facility.getName() : "Boxora Self-Storage")
                .rentalMonths(months)
                .startDate(startDate)
                .endDate(endDate)
                .monthlyRate(monthlyRate)
                .subtotalRentalFee(subtotal)
                .discountCode(appliedDiscountCode)
                .discountPercentage(discountPct)
                .discountAmount(discountAmount)
                .totalRentalFee(totalRentalFee)
                .depositAmount(depositAmount)
                .initialPaymentAmount(initialPayment)
                .totalContractValue(totalContractValue)
                .refundSlaDays(slaDays)
                .cancellationPolicy(cancellationPolicy)
                .holdGraceHours(holdGraceHours)
                .maxHoldDays(maxHoldDays)
                .build();
    }
}
