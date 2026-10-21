package com.boxora.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Kết quả một lượt xử lý quá hạn theo chính sách của từng cơ sở (ân hạn, phí trễ hạn, khóa truy cập, mốc niêm phong)")
public class OverdueProcessResult {

    @Schema(description = "Thời điểm chạy")
    private LocalDateTime executionTime;

    @Schema(description = "Ngày dùng để tính số ngày quá hạn")
    private LocalDate asOfDate;

    @Schema(description = "Cơ sở được xử lý; null khi xử lý toàn hệ thống")
    private UUID facilityId;

    @Schema(description = "Số hợp đồng quá hạn đã quét")
    private int scannedOverdueContractsCount;

    @Schema(description = "Số hợp đồng được ghi nhận/cập nhật phí trễ hạn")
    private int lateFeeAssessedCount;

    @Schema(description = "Số hợp đồng bị khóa truy cập trong lượt này")
    private int pinDisabledCount;

    @Schema(description = "Số hợp đồng vừa đến mốc niêm phong (chờ quản lý lập biên bản)")
    private int sealingEligibleCount;

    @Schema(description = "Số hợp đồng đã gia hạn được tự động mở lại quyền truy cập")
    private int accessRestoredCount;

    @Schema(description = "Số hợp đồng không bị khóa lại vì đang trong thời gian giữ quyền truy cập do quản lý cho phép")
    private int onHoldCount;

    @Schema(description = "Chi tiết từng hợp đồng")
    @Builder.Default
    private List<OverdueContractDetail> details = new ArrayList<>();
}
