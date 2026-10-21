package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Báo cáo công nợ quá hạn. {@code totalOverdueCount}/{@code totalDebtAmount} tính mọi khoản đã qua hạn hợp đồng
 * (kể cả đang trong thời gian ân hạn); phần chưa vượt ân hạn được tách riêng trong {@code gracePeriodDebt},
 * còn {@code delinquentDebtAmount} là nợ đã vượt ân hạn (số nên hiển thị là "nợ quá hạn").
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OverdueDebtReportResponse {
    private LocalDate asOfDate;
    private long totalOverdueCount;
    private BigDecimal totalDebtAmount;
    private BigDecimal totalUnpaidRent;
    private BigDecimal totalLateFees;

    /** Nợ của các khoản vẫn trong thời gian ân hạn (chưa tính là nợ quá hạn). */
    private BigDecimal gracePeriodDebt;
    /** Số khoản đã vượt thời gian ân hạn. */
    private long delinquentCount;
    /** totalDebtAmount - gracePeriodDebt. */
    private BigDecimal delinquentDebtAmount;
    /** Số kho đang bị khóa thực tế (đã thu hồi PIN/QR, khóa hoặc niêm phong). */
    private long lockedUnitCount;

    private long gracePeriodCount;
    private long warningCount;
    private long accessBlockedCount;
    private long eligibleForSealingCount;

    private BigDecimal aging1To3DaysDebt;
    private BigDecimal aging4To7DaysDebt;
    private BigDecimal aging8To14DaysDebt;
    private BigDecimal aging15PlusDaysDebt;

    private List<OverdueDebtItemResponse> items;
    private List<FacilityOverdueDebtResponse> byFacility;
}
