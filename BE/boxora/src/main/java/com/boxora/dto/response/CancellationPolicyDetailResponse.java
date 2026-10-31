package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancellationPolicyDetailResponse {
    private UUID facilityId;
    private String facilityName;
    private String policyVersion;
    private Boolean isConfigured;

    // Các thông số hủy và hoàn tiền thực tế từ FacilityPolicy
    private Integer cancellationFullRefundHours;
    private Integer cancellationPartialRefundHours;
    private Double cancellationPartialRefundPercent;
    private Integer returnNoticeDays;
    private Integer depositRefundSlaDays;
    private Integer holdGraceHours;
    private Double depositPercentage;

    private String policySummaryText;
}
