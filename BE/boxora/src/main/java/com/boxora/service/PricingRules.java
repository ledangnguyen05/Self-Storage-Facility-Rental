package com.boxora.service;

import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.FacilityPolicyPrice;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

/**
 * Quy tắc tính giá DUY NHẤT của Boxora. Giá niêm yết trên danh sách kho, báo giá (PricingService)
 * và số tiền thực thu đều đi qua các hàm tĩnh ở đây, nên hai con số không thể lệch nhau.
 *
 * <p>Thứ tự lấy đơn giá thuê một tháng của một kho:
 * <ol>
 *   <li>Giá riêng của cơ sở cho loại kho đó (bảng giá trong chính sách đang áp dụng);</li>
 *   <li>Đơn giá của chính kho (khi quản lý cơ sở đã chỉnh riêng);</li>
 *   <li>Đơn giá niêm yết chung của loại kho.</li>
 * </ol>
 * Không có giá nào thì trả {@code null} để người gọi báo lỗi, tuyệt đối không bịa ra một mức giá.
 *
 * <p>Tiền cọc = đơn giá tháng x tỷ lệ cọc của chính sách (mặc định 100%, BR-RULE-002).
 * Chiết khấu kỳ hạn lấy từ bảng giá của cơ sở (mốc 3, 6, 12 tháng); cơ sở chưa có bảng giá riêng
 * dùng bậc mặc định của hệ thống.
 */
public final class PricingRules {

    private PricingRules() {
    }

    /** Một mốc chiết khấu theo kỳ hạn: thuê từ {@code months} tháng trở lên được giảm {@code percent}%. */
    public record TermDiscount(int months, double percent) {
    }

    /** Bậc chiết khấu mặc định khi cơ sở chưa cấu hình giá riêng cho loại kho. */
    public static final List<TermDiscount> SYSTEM_TERM_DISCOUNTS = List.of(
            new TermDiscount(3, 5.0),
            new TermDiscount(6, 10.0),
            new TermDiscount(12, 15.0),
            new TermDiscount(24, 20.0)
    );

    /** Nguồn của đơn giá, trả về trong báo giá để giao diện giải thích được con số. */
    public enum PriceSource {
        FACILITY_POLICY, UNIT, UNIT_TYPE, NONE
    }

    public static Optional<FacilityPolicyPrice> findPolicyPrice(FacilityPolicy activePolicy, UnitType unitType) {
        return unitType == null ? Optional.empty() : findPolicyPrice(activePolicy, unitType.getId());
    }

    public static Optional<FacilityPolicyPrice> findPolicyPrice(FacilityPolicy activePolicy, java.util.UUID unitTypeId) {
        if (activePolicy == null || unitTypeId == null || activePolicy.getPrices() == null) {
            return Optional.empty();
        }
        return activePolicy.getPrices().stream()
                .filter(price -> price.getUnitType() != null && unitTypeId.equals(price.getUnitType().getId()))
                .filter(price -> isPositive(price.getMonthlyPrice()))
                .findFirst();
    }

    public static PriceSource priceSource(StorageUnit unit, FacilityPolicy activePolicy) {
        if (unit == null) {
            return PriceSource.NONE;
        }
        if (findPolicyPrice(activePolicy, unit.getUnitType()).isPresent()) {
            return PriceSource.FACILITY_POLICY;
        }
        if (isPositive(unit.getPricePerMonth())) {
            return PriceSource.UNIT;
        }
        if (unit.getUnitType() != null && isPositive(unit.getUnitType().getBasePricePerMonth())) {
            return PriceSource.UNIT_TYPE;
        }
        return PriceSource.NONE;
    }

    /** Đơn giá thuê một tháng; {@code null} nếu kho chưa có giá nào được cấu hình. */
    public static BigDecimal resolveMonthlyPrice(StorageUnit unit, FacilityPolicy activePolicy) {
        if (unit == null) {
            return null;
        }
        Optional<FacilityPolicyPrice> policyPrice = findPolicyPrice(activePolicy, unit.getUnitType());
        if (policyPrice.isPresent()) {
            return policyPrice.get().getMonthlyPrice();
        }
        if (isPositive(unit.getPricePerMonth())) {
            return unit.getPricePerMonth();
        }
        if (unit.getUnitType() != null && isPositive(unit.getUnitType().getBasePricePerMonth())) {
            return unit.getUnitType().getBasePricePerMonth();
        }
        return null;
    }

    public static double depositPercentage(FacilityPolicy activePolicy) {
        if (activePolicy == null || activePolicy.getDepositPercentage() == null || activePolicy.getDepositPercentage() < 0) {
            return FacilityPolicyDefaults.DEPOSIT_PERCENTAGE;
        }
        return activePolicy.getDepositPercentage();
    }

    /** Tiền cọc của một kho có đơn giá tháng {@code monthlyPrice}, làm tròn tới đồng. */
    public static BigDecimal depositFor(BigDecimal monthlyPrice, FacilityPolicy activePolicy) {
        if (monthlyPrice == null) {
            return null;
        }
        return percentOf(monthlyPrice, depositPercentage(activePolicy));
    }

    /**
     * Phần trăm chiết khấu theo kỳ hạn. {@code policyPrice == null} nghĩa là cơ sở không có bảng giá riêng
     * cho loại kho này, dùng bậc mặc định của hệ thống.
     */
    public static double termDiscountPercent(FacilityPolicyPrice policyPrice, int months) {
        if (months <= 0) {
            return 0.0;
        }
        if (policyPrice == null) {
            double best = 0.0;
            for (TermDiscount tier : SYSTEM_TERM_DISCOUNTS) {
                if (months >= tier.months()) {
                    best = tier.percent();
                }
            }
            return best;
        }
        if (months >= 12) {
            return nonNegative(policyPrice.getDiscount12MonthPercent());
        }
        if (months >= 6) {
            return nonNegative(policyPrice.getDiscount6MonthPercent());
        }
        if (months >= 3) {
            return nonNegative(policyPrice.getDiscount3MonthPercent());
        }
        return 0.0;
    }

    /** Danh sách mốc chiết khấu áp dụng cho một loại kho tại cơ sở, để giao diện hiển thị trước khi báo giá. */
    public static List<TermDiscount> termDiscounts(FacilityPolicyPrice policyPrice) {
        if (policyPrice == null) {
            return SYSTEM_TERM_DISCOUNTS;
        }
        return List.of(
                new TermDiscount(3, nonNegative(policyPrice.getDiscount3MonthPercent())),
                new TermDiscount(6, nonNegative(policyPrice.getDiscount6MonthPercent())),
                new TermDiscount(12, nonNegative(policyPrice.getDiscount12MonthPercent()))
        );
    }

    /** {@code amount x percent / 100}, làm tròn tới đồng (HALF_UP). */
    public static BigDecimal percentOf(BigDecimal amount, double percent) {
        if (amount == null) {
            return BigDecimal.ZERO;
        }
        return amount.multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
    }

    private static double nonNegative(Double value) {
        return value == null || value < 0 ? 0.0 : value;
    }

    private static boolean isPositive(BigDecimal value) {
        return value != null && value.signum() > 0;
    }
}
