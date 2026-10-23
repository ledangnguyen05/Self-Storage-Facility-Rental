package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
@Schema(description = "Yêu cầu điều chỉnh đơn giá kho lưu trữ theo BR-RULE-011")
public class StorageUnitPriceAdjustmentRequest {

    @NotNull(message = "New price is required")
    @DecimalMin(value = "0.01", message = "Price must be greater than zero")
    @Schema(description = "Mức giá thuê mới (VNĐ/tháng)", example = "1650000.00")
    private BigDecimal newPrice;

    @Schema(description = "Thời điểm bắt đầu có hiệu lực (để trống mặc định là ngay lập tức)", example = "2026-10-07T00:00:00")
    private LocalDateTime effectiveFrom;

    @NotBlank(message = "Reason for price adjustment is mandatory under BR-RULE-011")
    @Schema(description = "Lý do điều chỉnh giá (bắt buộc theo quy định kiểm toán BR-RULE-011)", example = "Điều chỉnh tăng giá định kỳ quý 4 theo lạm phát và nâng cấp khóa thông minh")
    private String reason;
}

