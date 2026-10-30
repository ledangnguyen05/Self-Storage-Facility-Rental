package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu điều chỉnh giá loại kho theo quy tắc BR-RULE-011")
public class UnitTypePriceAdjustmentRequest {

    @NotNull(message = "New price is mandatory")
    @Positive(message = "Price must be greater than zero")
    @Schema(description = "Đơn giá tiêu chuẩn mới mỗi tháng (VNĐ)", example = "350000.00")
    private BigDecimal newPrice;

    @Schema(description = "Đơn giá máy lạnh A/C mới mỗi tháng (VNĐ)", example = "420000.00")
    private BigDecimal newAcPrice;

    @Schema(description = "Thời điểm giá mới bắt đầu có hiệu lực (mặc định là hiện tại)", example = "2026-10-10T00:00:00")
    private LocalDateTime effectiveFrom;

    @NotBlank(message = "Reason for price adjustment is mandatory under BR-RULE-011")
    @Schema(description = "Lý do điều chỉnh giá (bắt buộc theo quy định BR-RULE-011)",
            example = "Cập nhật giá niêm yết chuẩn theo chiến lược kinh doanh")
    private String reason;

    @Schema(description = "Tùy chọn: Đồng bộ cập nhật đơn giá cho các kho đang AVAILABLE thuộc loại kho này (mặc định true)",
            example = "true")
    @Builder.Default
    private Boolean cascadeToAvailableUnits = true;
}
