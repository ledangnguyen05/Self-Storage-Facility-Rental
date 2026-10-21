package com.boxora.service.impl;

import com.boxora.entity.Facility;
import com.boxora.entity.FacilityPolicy;
import com.boxora.entity.FacilityPolicyPrice;
import com.boxora.entity.UnitType;
import com.boxora.enums.FacilityStatus;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.UnitReportRepository;
import com.boxora.repository.UnitTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Describes the live catalogue (facilities, unit types, availability, prices, policy highlights) as text for
 * the chatbot's system prompt. Everything comes from the database; the snapshot is cached for a minute so a
 * burst of questions does not become a burst of queries.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatbotContextProvider {

    static final long CACHE_TTL_MS = 60_000;
    private static final int MAX_FACILITIES = 25;
    private static final int MAX_TYPES_PER_FACILITY = 12;
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM/yyyy");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final FacilityRepository facilityRepository;
    private final FacilityPolicyRepository facilityPolicyRepository;
    private final UnitTypeRepository unitTypeRepository;
    private final UnitReportRepository unitReportRepository;

    private volatile String cachedContext;
    private volatile long cachedAt;

    /** The catalogue text. A stale snapshot is served when the database cannot be read. */
    public String currentContext() {
        long now = System.currentTimeMillis();
        String snapshot = cachedContext;
        if (snapshot != null && now - cachedAt < CACHE_TTL_MS) {
            return snapshot;
        }
        synchronized (this) {
            if (cachedContext != null && System.currentTimeMillis() - cachedAt < CACHE_TTL_MS) {
                return cachedContext;
            }
            try {
                cachedContext = buildContext();
                cachedAt = System.currentTimeMillis();
            } catch (RuntimeException e) {
                log.error("Could not build the chatbot catalogue: {}", e.getClass().getSimpleName(), e);
                if (cachedContext == null) {
                    throw new AppException(ErrorCode.CHATBOT_UNAVAILABLE);
                }
            }
            return cachedContext;
        }
    }

    /** Drops the cached snapshot (used by tests and after bulk catalogue changes). */
    public synchronized void invalidate() {
        cachedContext = null;
        cachedAt = 0;
    }

    String buildContext() {
        List<Facility> facilities = facilityRepository.findAllByOrderByCreatedAtAsc().stream()
                .filter(facility -> facility.getStatus() == FacilityStatus.ACTIVE)
                .limit(MAX_FACILITIES)
                .toList();

        Map<UUID, UnitType> unitTypes = new HashMap<>();
        for (UnitType type : unitTypeRepository.findAll()) {
            unitTypes.put(type.getId(), type);
        }
        Map<UUID, FacilityPolicy> policies = new HashMap<>();
        for (FacilityPolicy policy : facilityPolicyRepository.findByIsActiveTrue()) {
            policies.put(policy.getFacility().getId(), policy);
        }

        // facilityId -> unitTypeId -> stock
        Map<UUID, Map<UUID, Stock>> stock = new HashMap<>();
        for (Object[] row : unitReportRepository.summarizeUnitsByFacilityTypeAndStatus()) {
            if (row[0] == null || row[1] == null) {
                continue;
            }
            Stock entry = stock.computeIfAbsent((UUID) row[0], key -> new LinkedHashMap<>())
                    .computeIfAbsent((UUID) row[1], key -> new Stock());
            long count = row[3] instanceof Number number ? number.longValue() : 0L;
            entry.total += count;
            if (row[2] == UnitStatus.AVAILABLE) {
                entry.available += count;
                entry.include((BigDecimal) row[4], (BigDecimal) row[5]);
            }
        }

        StringBuilder out = new StringBuilder();
        out.append("Dữ liệu cập nhật lúc ").append(LocalDateTime.now().format(STAMP)).append(".\n");
        if (facilities.isEmpty()) {
            out.append("\nHiện chưa có cơ sở nào đang hoạt động trong hệ thống.\n");
            return out.toString();
        }

        out.append("\nCÁC CƠ SỞ ĐANG HOẠT ĐỘNG:\n");
        int index = 1;
        // Facilities that share the same policy are described once, so the prompt stays short.
        Map<String, List<String>> facilitiesByPolicy = new LinkedHashMap<>();
        for (Facility facility : facilities) {
            appendFacility(out, index++, facility, stock.get(facility.getId()), unitTypes, policies.get(facility.getId()));
            facilitiesByPolicy.computeIfAbsent(describePolicy(policies.get(facility.getId())), key -> new ArrayList<>())
                    .add(facility.getName());
        }

        out.append("\nCHÍNH SÁCH:\n");
        for (Map.Entry<String, List<String>> entry : facilitiesByPolicy.entrySet()) {
            String scope = facilitiesByPolicy.size() == 1 && facilities.size() > 1
                    ? "Mọi cơ sở"
                    : String.join(", ", entry.getValue());
            out.append("- ").append(scope).append(": ").append(entry.getKey()).append('\n');
        }
        return out.toString();
    }

    private void appendFacility(StringBuilder out, int index, Facility facility,
                                Map<UUID, Stock> stock, Map<UUID, UnitType> unitTypes, FacilityPolicy policy) {
        out.append('\n').append(index).append(". ").append(facility.getName());
        if (facility.getCode() != null) {
            out.append(" (mã ").append(facility.getCode()).append(')');
        }
        out.append('\n');
        out.append("   - Địa chỉ: ").append(joinNonBlank(facility.getAddress(), facility.getCity())).append('\n');
        out.append("   - Giờ mở cửa: ").append(facility.getOpenTime().format(TIME)).append(" - ").append(facility.getCloseTime().format(TIME));
        if (facility.getContactPhone() != null && !facility.getContactPhone().isBlank()) {
            out.append(" | Điện thoại: ").append(facility.getContactPhone());
        }
        if (facility.getEmail() != null && !facility.getEmail().isBlank()) {
            out.append(" | Email: ").append(facility.getEmail());
        }
        out.append('\n');

        out.append("   - Các loại kho (giá niêm yết theo tháng):\n");
        List<Map.Entry<UUID, Stock>> entries = new ArrayList<>(stock != null ? stock.entrySet() : List.<Map.Entry<UUID, Stock>>of());
        entries.removeIf(entry -> unitTypes.get(entry.getKey()) == null);
        Map<UUID, FacilityPolicyPrice> policyPrices = new HashMap<>();
        if (policy != null && policy.getPrices() != null) {
            for (FacilityPolicyPrice price : policy.getPrices()) {
                policyPrices.put(price.getUnitType().getId(), price);
            }
        }
        entries.sort(Comparator.comparing((Map.Entry<UUID, Stock> entry) ->
                listedPrice(entry.getValue(), unitTypes.get(entry.getKey()), policyPrices.get(entry.getKey())).min()));
        if (entries.isEmpty()) {
            out.append("       (chưa có kho nào được niêm yết)\n");
        }
        int shown = 0;
        for (Map.Entry<UUID, Stock> entry : entries) {
            if (shown++ >= MAX_TYPES_PER_FACILITY) {
                break;
            }
            UnitType type = unitTypes.get(entry.getKey());
            Stock typeStock = entry.getValue();
            FacilityPolicyPrice policyPrice = policyPrices.get(entry.getKey());
            PriceRange price = listedPrice(typeStock, type, policyPrice);

            out.append("       * ").append(type.getTypeName()).append(" - ").append(type.getDimensions());
            if (type.getAreaSqm() != null) {
                out.append(" (").append(formatArea(type.getAreaSqm())).append(" m²)");
            }
            out.append(": ");
            out.append(typeStock.available > 0 ? "còn " + typeStock.available + " kho trống" : "hiện hết kho trống");
            out.append(", giá ").append(price.describe()).append("/tháng");
            if (policyPrice != null) {
                String discounts = describeDiscounts(policyPrice);
                if (!discounts.isEmpty()) {
                    out.append(", ").append(discounts);
                }
            }
            out.append('\n');
        }
    }

    private static String describePolicy(FacilityPolicy policy) {
        if (policy == null) {
            return "chưa có chính sách riêng được công bố, khách nên hỏi trực tiếp cơ sở.";
        }
        List<String> parts = new ArrayList<>();
        if (policy.getDepositPercentage() != null) {
            parts.add("tiền cọc bằng " + trimNumber(policy.getDepositPercentage()) + "% tiền thuê một tháng");
        }
        if (policy.getMinimumRentalMonths() != null) {
            parts.add("thuê tối thiểu " + policy.getMinimumRentalMonths() + " tháng");
        }
        if (policy.getHoldGraceHours() != null) {
            parts.add("giữ kho thêm " + policy.getHoldGraceHours() + " giờ sau giờ hẹn nhận kho");
        }
        if (policy.getCancellationFullRefundHours() != null) {
            parts.add("hủy trước giờ nhận kho ít nhất " + policy.getCancellationFullRefundHours() + " giờ được hoàn 100% tiền cọc");
        }
        if (policy.getCancellationPartialRefundHours() != null && policy.getCancellationPartialRefundPercent() != null) {
            parts.add("hủy trước ít nhất " + policy.getCancellationPartialRefundHours() + " giờ được hoàn "
                    + trimNumber(policy.getCancellationPartialRefundPercent()) + "% tiền cọc");
        }
        if (policy.getRenewalWindowDays() != null) {
            parts.add("gia hạn được trong " + policy.getRenewalWindowDays() + " ngày trước khi hết hạn");
        }
        if (policy.getReturnNoticeDays() != null && policy.getReturnNoticeDays() > 0) {
            parts.add("báo trả kho trước " + policy.getReturnNoticeDays() + " ngày");
        }
        if (policy.getDepositRefundSlaDays() != null) {
            parts.add("hoàn cọc trong " + policy.getDepositRefundSlaDays() + " ngày sau khi trả kho");
        }
        if (policy.getOverdueGraceDays() != null && policy.getDailyLateFee() != null) {
            parts.add("quá hạn có " + policy.getOverdueGraceDays() + " ngày ân hạn, sau đó phí trễ "
                    + money(policy.getDailyLateFee()) + "/ngày");
        }
        if (policy.getOverdueAccessDisableDays() != null) {
            parts.add("từ ngày quá hạn thứ " + policy.getOverdueAccessDisableDays() + " mã PIN bị thu hồi");
        }
        if (policy.getOverdueSealingDays() != null) {
            parts.add("từ ngày quá hạn thứ " + policy.getOverdueSealingDays() + " kho có thể bị niêm phong");
        }
        return parts.isEmpty() ? "chưa có thông tin chi tiết." : String.join("; ", parts) + ".";
    }

    private static String describeDiscounts(FacilityPolicyPrice price) {
        List<String> parts = new ArrayList<>();
        if (price.getDiscount3MonthPercent() != null && price.getDiscount3MonthPercent() > 0) {
            parts.add("giảm " + trimNumber(price.getDiscount3MonthPercent()) + "% khi thuê từ 3 tháng");
        }
        if (price.getDiscount6MonthPercent() != null && price.getDiscount6MonthPercent() > 0) {
            parts.add("giảm " + trimNumber(price.getDiscount6MonthPercent()) + "% khi thuê từ 6 tháng");
        }
        if (price.getDiscount12MonthPercent() != null && price.getDiscount12MonthPercent() > 0) {
            parts.add("giảm " + trimNumber(price.getDiscount12MonthPercent()) + "% khi thuê từ 12 tháng");
        }
        return String.join(", ", parts);
    }

    /** Facility policy price when set; otherwise the prices of the units that are free; otherwise the type's base price. */
    private static PriceRange listedPrice(Stock stock, UnitType type, FacilityPolicyPrice policyPrice) {
        if (policyPrice != null && policyPrice.getMonthlyPrice() != null) {
            return new PriceRange(policyPrice.getMonthlyPrice(), policyPrice.getMonthlyPrice());
        }
        if (stock.minPrice != null && stock.maxPrice != null) {
            return new PriceRange(stock.minPrice, stock.maxPrice);
        }
        BigDecimal base = type.getBasePricePerMonth() != null ? type.getBasePricePerMonth() : BigDecimal.ZERO;
        return new PriceRange(base, base);
    }

    private static String joinNonBlank(String... values) {
        List<String> parts = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                parts.add(value.trim());
            }
        }
        return parts.isEmpty() ? "chưa cập nhật" : String.join(", ", parts);
    }

    private static String money(BigDecimal value) {
        NumberFormat format = NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN"));
        return format.format(value) + " ₫";
    }

    private static String trimNumber(Double value) {
        return value == Math.rint(value) ? String.valueOf(value.longValue()) : String.valueOf(value);
    }

    private static String formatArea(Double area) {
        return trimNumber(area);
    }

    private record PriceRange(BigDecimal min, BigDecimal max) {
        String describe() {
            return min.compareTo(max) == 0 ? money(min) : "từ " + money(min) + " đến " + money(max);
        }
    }

    /** Units of one type in one facility. Prices are those of the units that are currently free. */
    private static final class Stock {
        private long total;
        private long available;
        private BigDecimal minPrice;
        private BigDecimal maxPrice;

        private void include(BigDecimal min, BigDecimal max) {
            if (min != null && (minPrice == null || min.compareTo(minPrice) < 0)) {
                minPrice = min;
            }
            if (max != null && (maxPrice == null || max.compareTo(maxPrice) > 0)) {
                maxPrice = max;
            }
        }
    }
}
