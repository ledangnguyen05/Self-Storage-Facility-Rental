package com.boxora.service.impl;

import com.boxora.dto.response.FacilityOccupancyResponse;
import com.boxora.dto.response.FacilityRevenueResponse;
import com.boxora.dto.response.MonthlyRevenueResponse;
import com.boxora.dto.response.OccupancyReportResponse;
import com.boxora.dto.response.OverdueDebtReportResponse;
import com.boxora.dto.response.PaymentChannelItemResponse;
import com.boxora.dto.response.PaymentChannelReportResponse;
import com.boxora.dto.response.RevenueReportResponse;
import com.boxora.dto.response.RevenueTrendResponse;
import com.boxora.dto.response.SystemOccupancyResponse;
import com.boxora.dto.response.SystemRevenueSummaryResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.RentalContract;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.NotificationChannel;
import com.boxora.enums.NotificationType;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.enums.UnitStatus;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.PaymentReportRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.repository.UnitReportRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.ActivityLogService;
import com.boxora.service.EmailService;
import com.boxora.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true) // reports only read data, never mutate it
public class ReportServiceImpl implements ReportService {

    /** Open period bounds used when the caller does not pass a date. */
    private static final LocalDate OPEN_FROM = LocalDate.of(2000, 1, 1);
    private static final LocalDate OPEN_TO = LocalDate.of(2099, 12, 31);
    /** Longest zero-filled month series returned by the trend report. */
    private static final int MAX_TREND_MONTHS = 120;
    /** Channel key for payments whose method was never recorded. */
    private static final String UNKNOWN_CHANNEL = "OTHER";

    private final PaymentReportRepository paymentReportRepository;
    private final UnitReportRepository unitReportRepository;
    private final FacilityRepository facilityRepository;
    private final RentalContractRepository rentalContractRepository;
    private final NotificationLogRepository notificationLogRepository;
    private final OverdueDebtReportBuilder overdueDebtReportBuilder;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;
    private final FacilityAccessGuard facilityAccessGuard;

    // ============================================================ revenue

    @Override
    public RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate) {
        return getRevenueReport(fromDate, toDate, null);
    }

    @Override
    public RevenueReportResponse getRevenueReport(LocalDate fromDate, LocalDate toDate, UUID facilityId) {
        validatePeriod(fromDate, toDate);
        UUID scope = resolveFacilityScope(facilityId);

        List<Object[]> rows = paymentReportRepository.aggregateByFacilityTypeAndStatus(
                periodStart(fromDate), periodEndExclusive(toDate), scope);

        Map<UUID, RevenueAccumulator> byFacilityId = new LinkedHashMap<>();
        RevenueAccumulator unassigned = null;
        for (Object[] row : rows) {
            UUID rowFacilityId = (UUID) row[0];
            RevenueAccumulator accumulator;
            if (rowFacilityId == null) {
                if (unassigned == null) {
                    unassigned = new RevenueAccumulator(null, "Chưa gắn với cơ sở nào");
                }
                accumulator = unassigned;
            } else {
                accumulator = byFacilityId.computeIfAbsent(rowFacilityId, id -> new RevenueAccumulator(id, (String) row[1]));
            }
            accumulator.add(
                    (PaymentType) row[2],
                    (PaymentStatus) row[3],
                    toBigDecimal(row[4]),
                    toLong(row[5]),
                    toBigDecimal(row[6]));
        }

        // Every facility in scope gets a row (0 when it had no payment), so the table never shows a gap.
        for (Facility facility : facilityRepository.findAllByOrderByCreatedAtAsc()) {
            if (scope == null || scope.equals(facility.getId())) {
                byFacilityId.computeIfAbsent(facility.getId(), id -> new RevenueAccumulator(id, facility.getName()));
            }
        }

        List<RevenueAccumulator> accumulators = new ArrayList<>(byFacilityId.values());
        accumulators.sort(Comparator.comparing(RevenueAccumulator::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));

        RevenueAccumulator system = new RevenueAccumulator(null, null);
        List<FacilityRevenueResponse> byFacility = new ArrayList<>();
        for (RevenueAccumulator accumulator : accumulators) {
            byFacility.add(accumulator.toFacilityResponse());
            system.merge(accumulator);
        }
        if (unassigned != null) {
            byFacility.add(unassigned.toFacilityResponse());
            system.merge(unassigned);
        }

        return RevenueReportResponse.builder()
                .fromDate(fromDate)
                .toDate(toDate)
                .systemSummary(system.toSystemResponse())
                .byFacility(byFacility)
                .build();
    }

    @Override
    public RevenueTrendResponse getRevenueTrend(LocalDate fromDate, LocalDate toDate, UUID facilityId) {
        validatePeriod(fromDate, toDate);
        UUID scope = resolveFacilityScope(facilityId);

        TreeMap<YearMonth, MonthAccumulator> months = new TreeMap<>();
        for (Object[] row : paymentReportRepository.aggregateByMonth(periodStart(fromDate), periodEndExclusive(toDate), scope)) {
            if (row[0] == null || row[1] == null) {
                continue;
            }
            YearMonth month = YearMonth.of(((Number) row[0]).intValue(), ((Number) row[1]).intValue());
            MonthAccumulator accumulator = months.computeIfAbsent(month, key -> new MonthAccumulator());
            BigDecimal amount = toBigDecimal(row[4]);
            long count = toLong(row[5]);
            PaymentType type = (PaymentType) row[2];
            if (row[3] == PaymentStatus.PAID) {
                accumulator.collected = accumulator.collected.add(amount);
                accumulator.count += count;
                accumulator.byType.merge(type, amount, BigDecimal::add);
            } else if (row[3] == PaymentStatus.REFUNDED) {
                accumulator.refunded = accumulator.refunded.add(amount);
            }
        }

        YearMonth first = fromDate != null ? YearMonth.from(fromDate) : (months.isEmpty() ? null : months.firstKey());
        YearMonth last = toDate != null ? YearMonth.from(toDate) : (months.isEmpty() ? null : months.lastKey());
        if (first != null && last != null && first.isAfter(last)) {
            last = first;
        }

        List<MonthlyRevenueResponse> series = new ArrayList<>();
        BigDecimal totalCollected = BigDecimal.ZERO;
        BigDecimal totalRefunded = BigDecimal.ZERO;
        long totalCount = 0;
        if (first != null && last != null) {
            YearMonth cursor = first;
            if (cursor.until(last, java.time.temporal.ChronoUnit.MONTHS) >= MAX_TREND_MONTHS) {
                cursor = last.minusMonths(MAX_TREND_MONTHS - 1L);
            }
            for (; !cursor.isAfter(last); cursor = cursor.plusMonths(1)) {
                MonthAccumulator accumulator = months.getOrDefault(cursor, new MonthAccumulator());
                Map<String, BigDecimal> byType = new LinkedHashMap<>();
                for (PaymentType type : PaymentType.values()) {
                    byType.put(type.name(), accumulator.byType.getOrDefault(type, BigDecimal.ZERO));
                }
                series.add(MonthlyRevenueResponse.builder()
                        .month(cursor.toString())
                        .collectedAmount(accumulator.collected)
                        .refundedAmount(accumulator.refunded)
                        .netAmount(accumulator.collected.subtract(accumulator.refunded))
                        .paymentCount(accumulator.count)
                        .collectedByType(byType)
                        .build());
                totalCollected = totalCollected.add(accumulator.collected);
                totalRefunded = totalRefunded.add(accumulator.refunded);
                totalCount += accumulator.count;
            }
        }

        return RevenueTrendResponse.builder()
                .fromDate(fromDate)
                .toDate(toDate)
                .months(series)
                .totalCollected(totalCollected)
                .totalRefunded(totalRefunded)
                .totalNet(totalCollected.subtract(totalRefunded))
                .totalPaymentCount(totalCount)
                .build();
    }

    @Override
    public PaymentChannelReportResponse getPaymentChannels(LocalDate fromDate, LocalDate toDate, UUID facilityId) {
        validatePeriod(fromDate, toDate);
        UUID scope = resolveFacilityScope(facilityId);

        Map<String, long[]> counts = new HashMap<>();
        Map<String, BigDecimal> amounts = new HashMap<>();
        for (Object[] row : paymentReportRepository.aggregateByMethod(periodStart(fromDate), periodEndExclusive(toDate), scope)) {
            String method = row[0] instanceof String text && !text.isBlank() ? text.trim().toUpperCase(Locale.ROOT) : UNKNOWN_CHANNEL;
            counts.computeIfAbsent(method, key -> new long[1])[0] += toLong(row[1]);
            amounts.merge(method, toBigDecimal(row[2]), BigDecimal::add);
        }

        List<PaymentChannelItemResponse> channels = new ArrayList<>();
        long totalCount = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (Map.Entry<String, long[]> entry : counts.entrySet()) {
            BigDecimal amount = amounts.getOrDefault(entry.getKey(), BigDecimal.ZERO);
            channels.add(PaymentChannelItemResponse.builder()
                    .method(entry.getKey())
                    .count(entry.getValue()[0])
                    .amount(amount)
                    .build());
            totalCount += entry.getValue()[0];
            totalAmount = totalAmount.add(amount);
        }
        channels.sort(Comparator.comparingLong(PaymentChannelItemResponse::getCount).reversed()
                .thenComparing(PaymentChannelItemResponse::getMethod));

        return PaymentChannelReportResponse.builder()
                .fromDate(fromDate)
                .toDate(toDate)
                .totalCount(totalCount)
                .totalAmount(totalAmount)
                .channels(channels)
                .build();
    }

    // ============================================================ occupancy

    @Override
    public OccupancyReportResponse getOccupancyReport() {
        return getOccupancyReport(null);
    }

    @Override
    public OccupancyReportResponse getOccupancyReport(UUID facilityId) {
        UUID scope = resolveFacilityScope(facilityId);

        Map<UUID, String> facilityNames = new LinkedHashMap<>();
        // bucket layout per facility: [total, occupied (incl. locked), available, reserved, maintenance, locked]
        Map<UUID, long[]> counts = new LinkedHashMap<>();

        for (Object[] row : unitReportRepository.countUnitsByFacilityAndStatus()) {
            UUID rowFacilityId = (UUID) row[0];
            facilityNames.putIfAbsent(rowFacilityId, (String) row[1]);
            long[] bucket = counts.computeIfAbsent(rowFacilityId, key -> new long[6]);
            if (!(row[2] instanceof UnitStatus status)) {
                continue; // facility without units: keeps its all-zero bucket
            }
            long count = toLong(row[3]);
            bucket[0] += count;
            switch (status) {
                case OCCUPIED -> bucket[1] += count;
                case OVERDUE_LOCKED -> {
                    bucket[1] += count;
                    bucket[5] += count;
                }
                case AVAILABLE -> bucket[2] += count;
                case RESERVED -> bucket[3] += count;
                case UNDER_MAINTENANCE -> bucket[4] += count;
            }
        }

        List<FacilityOccupancyResponse> byFacility = new ArrayList<>();
        long[] system = new long[6];

        for (Map.Entry<UUID, long[]> entry : counts.entrySet()) {
            UUID rowFacilityId = entry.getKey();
            if (scope != null && !scope.equals(rowFacilityId)) {
                continue;
            }
            long[] c = entry.getValue();
            byFacility.add(FacilityOccupancyResponse.builder()
                    .facilityId(rowFacilityId)
                    .facilityName(facilityNames.get(rowFacilityId))
                    .totalUnits(c[0])
                    .occupiedUnits(c[1])
                    .lockedUnits(c[5])
                    .availableUnits(c[2])
                    .reservedUnits(c[3])
                    .maintenanceUnits(c[4])
                    .occupancyRate(rate(c[1], c[0]))
                    .build());
            for (int i = 0; i < system.length; i++) {
                system[i] += c[i];
            }
        }

        SystemOccupancyResponse systemSummary = SystemOccupancyResponse.builder()
                .totalUnits(system[0])
                .occupiedUnits(system[1])
                .lockedUnits(system[5])
                .availableUnits(system[2])
                .reservedUnits(system[3])
                .maintenanceUnits(system[4])
                .occupancyRate(rate(system[1], system[0]))
                .build();

        return OccupancyReportResponse.builder()
                .systemSummary(systemSummary)
                .byFacility(byFacility)
                .build();
    }

    // ============================================================ overdue debt

    @Override
    public OverdueDebtReportResponse getOverdueDebtReport(UUID filterFacilityId) {
        return overdueDebtReportBuilder.build(resolveFacilityScope(filterFacilityId), LocalDate.now());
    }

    @Override
    @Transactional
    public void sendOverdueReminder(UUID contractId) {
        RentalContract contract = rentalContractRepository.findById(contractId)
                .orElseThrow(() -> new AppException(ErrorCode.CONTRACT_NOT_FOUND));

        Facility facility = contract.getFacility();
        if (facilityAccessGuard.isFacilityScoped()) {
            if (facility == null) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            facilityAccessGuard.checkFacilityAccess(facility.getId());
        }

        LocalDate today = LocalDate.now();
        OverdueDebtReportBuilder.DebtFigures figures = overdueDebtReportBuilder.figuresFor(contract, today);
        if (figures == null) {
            throw new AppException(ErrorCode.OVERDUE_REMINDER_NOT_OVERDUE);
        }

        User customer = contract.getCustomer();
        if (customer == null || customer.getEmail() == null || customer.getEmail().isBlank()) {
            throw new AppException(ErrorCode.OVERDUE_REMINDER_NO_EMAIL);
        }
        if (!emailService.isMailConfigured()) {
            throw new AppException(ErrorCode.OVERDUE_REMINDER_EMAIL_UNAVAILABLE);
        }

        String customerName = customer.getFullName() != null && !customer.getFullName().isBlank()
                ? customer.getFullName() : customer.getUsername();
        String unitCode = contract.getUnit() != null ? contract.getUnit().getUnitCode() : "—";
        String subject = "[Boxora] Nhắc thanh toán công nợ quá hạn - hợp đồng " + contract.getContractCode();
        String body = renderReminderEmail(customerName, contract.getContractCode(), unitCode, contract.getEndDate(), figures);

        // Synchronous on purpose: the API only reports success when the mail server accepted the message.
        emailService.sendNow(customer.getEmail(), subject, body);

        notificationLogRepository.save(NotificationLog.builder()
                .recipient(customer)
                .recipientEmail(customer.getEmail())
                .recipientName(customerName)
                .facility(facility)
                .channel(NotificationChannel.EMAIL)
                .notificationType(NotificationType.OVERDUE_NOTICE)
                .referenceType("RentalContract")
                .referenceId(contract.getId())
                .title(subject)
                .content("Quá hạn " + figures.daysOverdue() + " ngày, còn nợ " + formatMoney(figures.totalDebt()))
                .status("SENT")
                .build());

        activityLogService.record(
                facility != null ? facility.getId() : null,
                ActivityAction.OVERDUE_REMINDER_SENT,
                "RentalContract",
                contract.getId(),
                "Đã gửi email nhắc nợ quá hạn tới " + customer.getEmail() + ": quá hạn " + figures.daysOverdue()
                        + " ngày, còn nợ " + formatMoney(figures.totalDebt()),
                null,
                contract.getContractCode()
        );
    }

    private String renderReminderEmail(String customerName, String contractCode, String unitCode,
                                       LocalDate dueDate, OverdueDebtReportBuilder.DebtFigures figures) {
        String stage = switch (figures.stage()) {
            case GRACE_PERIOD -> "Đang trong thời gian ân hạn, chưa tính phí trễ hạn";
            case WARNING -> "Đã quá hạn, bắt đầu tính phí trễ hạn";
            case ACCESS_BLOCKED -> "Quyền ra vào kho có thể bị thu hồi";
            case ELIGIBLE_FOR_SEALING -> "Kho có thể bị niêm phong theo hợp đồng";
            case CURRENT -> "Hợp đồng còn hiệu lực";
        };
        return """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #D92D20; border-radius: 8px;">
                    <h2 style="color: #B42318; margin-top: 0;">Nhắc thanh toán công nợ quá hạn</h2>
                    <p>Kính gửi <strong>%s</strong>,</p>
                    <p>Hợp đồng thuê kho <strong>%s</strong> (kho <strong>%s</strong>) đã hết hạn ngày <strong>%s</strong> và hiện còn công nợ chưa thanh toán.</p>
                    <div style="background-color: #FEF3F2; border-left: 4px solid #D92D20; padding: 14px; margin: 16px 0;">
                        <p style="margin: 4px 0;">Số ngày quá hạn: <strong>%d ngày</strong></p>
                        <p style="margin: 4px 0;">Giai đoạn hiện tại: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Tiền thuê còn nợ: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Phí trễ hạn: <strong>%s</strong></p>
                        <p style="margin: 4px 0;">Tổng cần thanh toán: <strong style="color: #B42318; font-size: 18px;">%s</strong></p>
                    </div>
                    <p>Vui lòng đăng nhập Boxora để thanh toán hoặc liên hệ cơ sở để được hỗ trợ.</p>
                    <hr style="border: 0; border-top: 1px solid #FECDCA; margin: 20px 0;"/>
                    <p style="color: #667085; font-size: 12px;">Email tự động từ Boxora. Nếu bạn đã thanh toán, vui lòng bỏ qua thông báo này.</p>
                </div>
                """.formatted(
                HtmlUtils.htmlEscape(customerName != null ? customerName : ""),
                HtmlUtils.htmlEscape(contractCode != null ? contractCode : "—"),
                HtmlUtils.htmlEscape(unitCode),
                dueDate != null ? String.format("%02d/%02d/%d", dueDate.getDayOfMonth(), dueDate.getMonthValue(), dueDate.getYear()) : "—",
                figures.daysOverdue(),
                stage,
                formatMoney(figures.unpaidRent()),
                formatMoney(figures.lateFee()),
                formatMoney(figures.totalDebt()));
    }

    // ============================================================ helpers

    private void validatePeriod(LocalDate fromDate, LocalDate toDate) {
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new AppException(ErrorCode.REPORT_INVALID_PERIOD);
        }
    }

    /**
     * Facility filter actually applied: facility-scoped roles (staff, facility manager) always see their own
     * facility only; an account without an assigned facility sees nothing (never "everything").
     */
    private UUID resolveFacilityScope(UUID requestedFacilityId) {
        if (facilityAccessGuard.isFacilityScoped()) {
            UUID own = facilityAccessGuard.scopedFacilityIdOrNull();
            if (own == null) {
                throw new AppException(ErrorCode.FACILITY_ACCESS_DENIED);
            }
            return own;
        }
        return requestedFacilityId;
    }

    private static LocalDateTime periodStart(LocalDate fromDate) {
        return (fromDate != null ? fromDate : OPEN_FROM).atStartOfDay();
    }

    /** Exclusive upper bound: the start of the day after {@code toDate}. */
    private static LocalDateTime periodEndExclusive(LocalDate toDate) {
        return (toDate != null ? toDate : OPEN_TO).plusDays(1).atStartOfDay();
    }

    private static double rate(long occupied, long total) {
        return total == 0 ? 0.0 : Math.round((occupied * 10000.0) / total) / 100.0;
    }

    private static String formatMoney(BigDecimal value) {
        NumberFormat format = NumberFormat.getIntegerInstance(Locale.forLanguageTag("vi-VN"));
        return format.format(value != null ? value : BigDecimal.ZERO) + " ₫";
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        return value instanceof Number number ? new BigDecimal(number.toString()) : BigDecimal.ZERO;
    }

    private static long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    // ============================================================ accumulators

    private static final class MonthAccumulator {
        private BigDecimal collected = BigDecimal.ZERO;
        private BigDecimal refunded = BigDecimal.ZERO;
        private long count;
        private final Map<PaymentType, BigDecimal> byType = new EnumMap<>(PaymentType.class);
    }

    /** Sums the grouped payment rows of one facility (or of everything, for the system summary). */
    private static final class RevenueAccumulator {
        private final UUID facilityId;
        private final String name;
        private BigDecimal collected = BigDecimal.ZERO;
        private BigDecimal refunded = BigDecimal.ZERO;
        private BigDecimal pendingRefund = BigDecimal.ZERO;
        private BigDecimal deposit = BigDecimal.ZERO;
        private BigDecimal rental = BigDecimal.ZERO;
        private BigDecimal renewal = BigDecimal.ZERO;
        private BigDecimal extra = BigDecimal.ZERO;
        private long paymentCount;

        private RevenueAccumulator(UUID facilityId, String name) {
            this.facilityId = facilityId;
            this.name = name;
        }

        private String name() {
            return name;
        }

        private void add(PaymentType type, PaymentStatus status, BigDecimal amount, long count, BigDecimal bookingDepositPart) {
            if (status == PaymentStatus.REFUNDED) {
                refunded = refunded.add(amount);
                return;
            }
            if (status == PaymentStatus.REFUND_PENDING) {
                pendingRefund = pendingRefund.add(amount);
                return;
            }
            if (status != PaymentStatus.PAID) {
                return;
            }
            collected = collected.add(amount);
            paymentCount += count;
            switch (type) {
                case DEPOSIT -> deposit = deposit.add(amount);
                case RENTAL_FEE -> rental = rental.add(amount);
                case RENEWAL_FEE -> renewal = renewal.add(amount);
                case EXTRA_CHARGE -> extra = extra.add(amount);
                case BOOKING_PAYMENT -> {
                    // First online payment = deposit + first rent: split it so every bucket stays exact.
                    BigDecimal depositPart = bookingDepositPart.min(amount).max(BigDecimal.ZERO);
                    deposit = deposit.add(depositPart);
                    rental = rental.add(amount.subtract(depositPart));
                }
            }
        }

        private void merge(RevenueAccumulator other) {
            collected = collected.add(other.collected);
            refunded = refunded.add(other.refunded);
            pendingRefund = pendingRefund.add(other.pendingRefund);
            deposit = deposit.add(other.deposit);
            rental = rental.add(other.rental);
            renewal = renewal.add(other.renewal);
            extra = extra.add(other.extra);
            paymentCount += other.paymentCount;
        }

        private FacilityRevenueResponse toFacilityResponse() {
            return FacilityRevenueResponse.builder()
                    .facilityId(facilityId)
                    .facilityName(name)
                    .totalRevenue(collected.subtract(refunded))
                    .collectedAmount(collected)
                    .refundedAmount(refunded)
                    .pendingRefundAmount(pendingRefund)
                    .depositRevenue(deposit)
                    .rentalFeeRevenue(rental)
                    .renewalFeeRevenue(renewal)
                    .extraChargeRevenue(extra)
                    .paymentCount(paymentCount)
                    .build();
        }

        private SystemRevenueSummaryResponse toSystemResponse() {
            return SystemRevenueSummaryResponse.builder()
                    .totalRevenue(collected.subtract(refunded))
                    .collectedAmount(collected)
                    .refundedAmount(refunded)
                    .pendingRefundAmount(pendingRefund)
                    .depositRevenue(deposit)
                    .rentalFeeRevenue(rental)
                    .renewalFeeRevenue(renewal)
                    .extraChargeRevenue(extra)
                    .paymentCount(paymentCount)
                    .build();
        }
    }
}
