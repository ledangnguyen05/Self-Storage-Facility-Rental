package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DisputeResolveRequest {

    /** ADJUST_SETTLEMENT (điều chỉnh quyết toán) hoặc UPHOLD_SETTLEMENT (giữ nguyên quyết toán) */
    @NotBlank(message = "Hành động giải quyết khiếu nại không được để trống (ADJUST_SETTLEMENT hoặc UPHOLD_SETTLEMENT)")
    private String action;

    /** Bắt buộc: Ghi rõ lý do giải quyết khiếu nại */
    @NotBlank(message = "Lý do và ghi chú giải quyết khiếu nại không được để trống")
    private String resolutionNote;

    /** Các khoản phí điều chỉnh nếu action = ADJUST_SETTLEMENT */
    private BigDecimal adjustedDoorFee;
    private BigDecimal adjustedCleaningFee;
    private BigDecimal adjustedWallStructureFee;
    private BigDecimal adjustedSmartLockFee;
    private String adjustedSmartLockIssueType;
    private BigDecimal adjustedLostCardFee;
}
