package com.boxora.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Overdue scan results; credential revocation is recorded in Boxora and sealing remains a witnessed on-site action")
public class OverdueProcessResult {

    @Schema(description = "Thời điểm quét", example = "2026-10-07T01:00:00")
    private LocalDateTime executionTime;

    @Schema(description = "Tổng số hợp đồng đang quá hạn được phát hiện", example = "5")
    private int scannedOverdueContractsCount;

    @Schema(description = "Số trường hợp áp dụng phạt 5% (+1 ngày)", example = "5")
    private int latePenaltyCount;

    @Schema(description = "Số trường hợp bị khóa mã PIN truy cập (+3 ngày)", example = "3")
    private int pinDisabledCount;

    @Schema(description = "Physical sealing records created by this scan; the scan itself does not seal units", example = "0")
    private int sealedUnitsCount;

    @Schema(description = "Cases eligible for a witnessed on-site sealing workflow under facility policy", example = "1")
    private int sealingEligibleCount;

    @Schema(description = "Danh sách chi tiết từng ca xử lý quá hạn")
    @Builder.Default
    private List<OverdueContractDetail> details = new ArrayList<>();
}
