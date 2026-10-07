package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu cập nhật thông tin loại kho lưu trữ (Unit Type)")
public class UnitTypeUpdateRequest {

    @Size(max = 100, message = "Type name must not exceed 100 characters")
    @Schema(description = "Tên loại kho cập nhật", example = "Personal Locker (Mini Box Pro)")
    private String typeName;

    @Size(max = 50, message = "Dimensions must not exceed 50 characters")
    @Schema(description = "Kích thước kho cập nhật", example = "1.0m x 1.0m x 1.2m")
    private String dimensions;

    @Positive(message = "Area must be greater than zero")
    @Schema(description = "Diện tích sàn cập nhật (m²)", example = "1.0")
    private Double areaSqm;

    @Positive(message = "Base price per month must be greater than zero")
    @Schema(description = "Đơn giá cơ bản mới mỗi tháng (VNĐ)", example = "500000.00")
    private BigDecimal basePricePerMonth;

    @PositiveOrZero(message = "Deposit amount cannot be negative")
    @Schema(description = "Tiền đặt cọc chuẩn mới (VNĐ)", example = "500000.00")
    private BigDecimal depositAmount;

    @Schema(description = "Lý do thay đổi giá bắt buộc theo BR-RULE-011 nếu có thay đổi basePricePerMonth",
            example = "Điều chỉnh giá niêm yết theo định kỳ quý 4")
    private String priceChangeReason;
}
