package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
public class FacilityPolicyResponse {
    private UUID id;
    private UUID facilityId;
    private String facilityName;
    private Boolean isActive;
    private Double depositPercentage;

    private Integer renewalWindowDays;

    /** Số giờ gia hạn sau giờ hẹn nhận kho trước khi giữ chỗ tự hết hạn. */
    private Integer holdGraceHours;
    /** Số ngày tối đa được đặt giữ chỗ trước lịch hẹn. */
    private Integer maxHoldDays;

    private Integer cancellationFullRefundHours;
    private Integer cancellationPartialRefundHours;
    private Double cancellationPartialRefundPercent;

    private Integer returnNoticeDays;
    private Integer depositRefundSlaDays;

    private BigDecimal dailyLateFee;
    private Integer overdueGraceDays;
    private Integer overdueAccessDisableDays;
    private Integer overdueSealingDays;

    private Integer minimumRentalMonths;

    private List<FacilityPolicyPriceResponse> prices;
}
