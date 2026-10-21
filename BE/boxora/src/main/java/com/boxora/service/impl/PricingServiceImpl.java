package com.boxora.service.impl;

import com.boxora.dto.request.DiscountValidateRequest;
import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.DiscountValidateResponse;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.dto.response.TermDiscountResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.FacilityPolicyPrice;
import com.boxora.entity.StorageUnit;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.BookingRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.service.DiscountService;
import com.boxora.service.FacilityPolicyDefaults;
import com.boxora.service.FacilityRules;
import com.boxora.service.PricingRules;
import com.boxora.service.PricingService;
import com.boxora.service.UnitAvailability;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Nguồn tính tiền duy nhất. Đơn giá, chiết khấu kỳ hạn và tiền cọc đều lấy từ chính sách đang áp dụng của cơ sở
 * qua {@link PricingRules}, cùng quy tắc với danh sách kho nên giá niêm yết = báo giá = số tiền thu.
 */
@Service
@Slf4j
public class PricingServiceImpl implements PricingService {

    private final StorageUnitRepository storageUnitRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final DiscountService discountService;
    private final BookingRepository bookingRepository;

    public PricingServiceImpl(StorageUnitRepository storageUnitRepository,
                              FacilityPolicyRepository facilityPolicyRepository,
                              DiscountService discountService,
                              BookingRepository bookingRepository) {
        this.storageUnitRepository = storageUnitRepository;
        this.facilityPolicyRepository = facilityPolicyRepository;
        this.discountService = discountService;
        this.bookingRepository = bookingRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public PricingQuoteResponse calculateQuote(PricingQuoteRequest request) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(request.getStorageUnitId())
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));

        Facility facility = unit.getFacility();
        FacilityPolicy policy = activePolicyOf(facility);

        int months = (request.getRentalMonths() != null && request.getRentalMonths() >= 1)
                ? request.getRentalMonths()
                : 1;

        boolean renewal = Boolean.TRUE.equals(request.getRenewal());
        if (!renewal) {
            // Báo giá thuê mới chỉ dành cho kho còn thực sự đặt được: cơ sở đang hoạt động, kho trống, chưa có người giữ.
            // Giao diện đã ẩn các kho khác nhưng máy chủ phải tự chặn (ai biết mã kho đều gọi được API này).
            FacilityRules.assertAcceptsBookings(facility);
            assertUnitBookable(unit);
        }
        if (!renewal && policy != null && policy.getMinimumRentalMonths() != null && months < policy.getMinimumRentalMonths()) {
            throw new AppException(ErrorCode.BOOKING_MINIMUM_DURATION_INVALID,
                    "Cơ sở này yêu cầu thuê tối thiểu " + policy.getMinimumRentalMonths() + " tháng");
        }

        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();
        LocalDate endDate = startDate.plusMonths(months);

        // 1. Đơn giá thuê một tháng: giá riêng của cơ sở -> giá của kho -> giá niêm yết loại kho. Không có thì báo lỗi.
        BigDecimal monthlyPrice = PricingRules.resolveMonthlyPrice(unit, policy);
        if (monthlyPrice == null || monthlyPrice.signum() <= 0) {
            throw new AppException(ErrorCode.UNIT_TYPE_PRICE_NOT_CONFIGURED);
        }
        PricingRules.PriceSource priceSource = PricingRules.priceSource(unit, policy);

        // 2. Tổng cước thuê chưa giảm trừ
        BigDecimal subtotal = monthlyPrice.multiply(BigDecimal.valueOf(months));

        // 3. Chiết khấu kỳ hạn theo bảng giá của cơ sở (hoặc bậc mặc định của hệ thống)
        FacilityPolicyPrice policyPrice = PricingRules.findPolicyPrice(policy, unit.getUnitType()).orElse(null);
        double termPercent = PricingRules.termDiscountPercent(policyPrice, months);
        BigDecimal termDiscountAmount = capAt(PricingRules.percentOf(subtotal, termPercent), subtotal);

        // 4. Mã ưu đãi (nếu có): mã sai trả lỗi 400 rõ ràng, không bỏ qua âm thầm
        String appliedDiscountCode = null;
        BigDecimal discountAmount = BigDecimal.ZERO;

        String enteredCode = request.getDiscountCode() == null ? "" : request.getDiscountCode().trim();
        if (!enteredCode.isEmpty()) {
            DiscountValidateResponse validation = validateDiscountCode(enteredCode, facility, months, subtotal);
            if (Boolean.TRUE.equals(validation.getIsValid()) && validation.getDiscountAmount() != null) {
                appliedDiscountCode = validation.getCode();
                discountAmount = capAt(validation.getDiscountAmount().setScale(0, RoundingMode.HALF_UP), subtotal);
            }
        }

        // Mỗi báo giá chỉ áp dụng mức giảm lớn hơn giữa mã ưu đãi và chiết khấu kỳ hạn (không cộng dồn)
        if (termDiscountAmount.compareTo(discountAmount) > 0) {
            discountAmount = termDiscountAmount;
            appliedDiscountCode = termPercent > 0 ? termCode(termPercent) : null;
        }

        double discountPercent = subtotal.signum() > 0
                ? discountAmount.multiply(BigDecimal.valueOf(100)).divide(subtotal, 2, RoundingMode.HALF_UP).doubleValue()
                : 0.0;
        Integer discountPercentRounded = discountAmount.signum() > 0 ? (int) Math.round(discountPercent) : null;

        BigDecimal totalRentalFee = subtotal.subtract(discountAmount);
        if (totalRentalFee.signum() < 0) {
            totalRentalFee = BigDecimal.ZERO;
        }

        // 5. Tiền cọc = đơn giá tháng x tỷ lệ cọc của chính sách
        double depositPercentage = PricingRules.depositPercentage(policy);
        BigDecimal depositAmount = PricingRules.depositFor(monthlyPrice, policy);

        // 6. Khoản thanh toán ban đầu (tháng đầu + tiền cọc). Công thức tháng đầu trùng với PaymentService.
        BigDecimal firstMonthRent = totalRentalFee.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
        BigDecimal initialPayment = firstMonthRent.add(depositAmount);

        // 7. Tổng giá trị hợp đồng
        BigDecimal totalContractValue = totalRentalFee.add(depositAmount);

        int slaDays = (policy != null && policy.getDepositRefundSlaDays() != null)
                ? policy.getDepositRefundSlaDays()
                : FacilityPolicyDefaults.DEPOSIT_REFUND_SLA_DAYS;
        int holdGraceHours = (policy != null && policy.getHoldGraceHours() != null)
                ? policy.getHoldGraceHours()
                : FacilityPolicyDefaults.HOLD_GRACE_HOURS;
        int maxHoldDays = (policy != null && policy.getMaxHoldDays() != null)
                ? policy.getMaxHoldDays()
                : FacilityPolicyDefaults.MAX_HOLD_DAYS;

        String cancellationPolicy = "Giữ chỗ miễn phí theo lịch hẹn được bảo lưu đến giờ hẹn cộng thêm " + holdGraceHours
                + " giờ theo chính sách cơ sở. Sau khi nhận kho, tiền cọc được thẩm định hiện trường và hoàn trong tối đa "
                + slaDays + " ngày làm việc.";

        return PricingQuoteResponse.builder()
                .storageUnitId(unit.getId())
                .unitCode(unit.getUnitCode())
                .unitTypeName(unit.getUnitType() != null ? unit.getUnitType().getTypeName() : null)
                .facilityId(facility != null ? facility.getId() : null)
                .facilityName(facility != null ? facility.getName() : null)
                .rentalMonths(months)
                .startDate(startDate)
                .endDate(endDate)
                .monthlyPrice(monthlyPrice)
                .monthlyRate(monthlyPrice)
                .priceSource(priceSource.name())
                .subtotalRentalFee(subtotal)
                .discountCode(appliedDiscountCode)
                .discountPercentage(discountPercentRounded)
                .discountPercent(discountAmount.signum() > 0 ? discountPercent : null)
                .discountAmount(discountAmount)
                .totalRentalFee(totalRentalFee)
                .depositPercentage(depositPercentage)
                .depositAmount(depositAmount)
                .initialPaymentAmount(initialPayment)
                .totalContractValue(totalContractValue)
                .refundSlaDays(slaDays)
                .cancellationPolicy(cancellationPolicy)
                .holdGraceHours(holdGraceHours)
                .maxHoldDays(maxHoldDays)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TermDiscountResponse> getTermDiscounts(UUID storageUnitId) {
        StorageUnit unit = storageUnitRepository.findWithDetailsById(storageUnitId)
                .orElseThrow(() -> new AppException(ErrorCode.STORAGE_UNIT_NOT_FOUND));
        FacilityPolicy policy = activePolicyOf(unit.getFacility());
        FacilityPolicyPrice policyPrice = PricingRules.findPolicyPrice(policy, unit.getUnitType()).orElse(null);
        return PricingRules.termDiscounts(policyPrice).stream()
                .map(tier -> TermDiscountResponse.builder().months(tier.months()).percent(tier.percent()).build())
                .toList();
    }

    /** Kho phải ở trạng thái trống và không có đặt kho nào còn hiệu lực (kể cả khi cột trạng thái chưa kịp cập nhật). */
    private void assertUnitBookable(StorageUnit unit) {
        if (unit.getStatus() == UnitStatus.UNDER_MAINTENANCE) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE,
                    "Kho " + unit.getUnitCode() + " đang bảo trì nên tạm thời chưa thể thuê. Vui lòng chọn kho khác.");
        }
        if (unit.getStatus() != UnitStatus.AVAILABLE
                || bookingRepository.existsByStorageUnit_IdAndStatusIn(unit.getId(), UnitAvailability.LIVE_BOOKING_STATUSES)) {
            throw new AppException(ErrorCode.STORAGE_UNIT_NOT_AVAILABLE);
        }
    }

    private FacilityPolicy activePolicyOf(Facility facility) {
        return facility == null
                ? null
                : facilityPolicyRepository.findByFacility_IdAndIsActiveTrue(facility.getId()).orElse(null);
    }

    /** Mã sai trả về 400 với lý do cụ thể (hết hạn, chưa đủ số tháng, sai cơ sở...). */
    private DiscountValidateResponse validateDiscountCode(String code, Facility facility, int months, BigDecimal subtotal) {
        DiscountValidateRequest validateRequest = DiscountValidateRequest.builder()
                .code(code)
                .facilityId(facility != null ? facility.getId() : null)
                .rentalMonths(months)
                .baseAmount(subtotal)
                .build();
        try {
            return discountService.validateAndCalculateDiscount(validateRequest);
        } catch (AppException ex) {
            log.info("Discount code {} rejected for quote: {}", code, ex.getMessage());
            throw new AppException(ErrorCode.DISCOUNT_CODE_INVALID, ex.getMessage());
        }
    }

    private static BigDecimal capAt(BigDecimal amount, BigDecimal ceiling) {
        return amount.compareTo(ceiling) > 0 ? ceiling : amount;
    }

    private static String termCode(double percent) {
        BigDecimal pct = BigDecimal.valueOf(percent).stripTrailingZeros();
        return "TERM_" + pct.toPlainString().replace('.', '_') + "PCT";
    }
}
