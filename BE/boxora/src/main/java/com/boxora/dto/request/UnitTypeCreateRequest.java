package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
@Schema(description = "Yêu cầu tạo mới loại kho lưu trữ (Unit Type)")
public class UnitTypeCreateRequest {

    @NotBlank(message = "Type name is mandatory")
    @Size(max = 100, message = "Type name must not exceed 100 characters")
    @Schema(description = "Tên loại kho", example = "Personal Locker (Mini Box)")
    private String typeName;

    @NotBlank(message = "Dimensions is mandatory")
    @Size(max = 50, message = "Dimensions must not exceed 50 characters")
    @Schema(description = "Kích thước kho (Dài x Rộng x Cao)", example = "1.0m x 1.0m x 1.2m")
    private String dimensions;

    @NotNull(message = "Area (sqm) is mandatory")
    @Positive(message = "Area must be greater than zero")
    @Schema(description = "Diện tích sàn (m²)", example = "1.0")
    private Double areaSqm;

    @Positive(message = "Volume must be greater than zero")
    @Schema(description = "Thể tích (m³)", example = "1.0")
    private Double volumeM3;

    @Positive(message = "Length must be greater than zero")
    @Schema(description = "Chiều dài (m)", example = "1.0")
    private Double lengthM;

    @Positive(message = "Width must be greater than zero")
    @Schema(description = "Chiều rộng (m)", example = "1.0")
    private Double widthM;

    @Positive(message = "Height must be greater than zero")
    @Schema(description = "Chiều cao (m)", example = "1.2")
    private Double heightM;

    @PositiveOrZero(message = "Capacity boxes cannot be negative")
    @Schema(description = "Sức chứa ước tính (số thùng)", example = "6")
    private Integer capacityBoxes;

    @Builder.Default
    @Schema(description = "Trạng thái hoạt động của loại kho", example = "true")
    private Boolean isActive = true;

    @NotNull(message = "Base price per month is mandatory")
    @Positive(message = "Base price per month must be greater than zero")
    @Schema(description = "Đơn giá cơ bản thuê mỗi tháng (VNĐ)", example = "450000.00")
    private BigDecimal basePricePerMonth;

    @Positive(message = "AC price per month must be greater than zero")
    @Schema(description = "Đơn giá máy lạnh A/C mỗi tháng (VNĐ)", example = "540000.00")
    private BigDecimal acPricePerMonth;

    @NotNull(message = "Deposit amount is mandatory")
    @PositiveOrZero(message = "Deposit amount cannot be negative")
    @Schema(description = "Tiền đặt cọc chuẩn (VNĐ)", example = "450000.00")
    private BigDecimal depositAmount;

    @Schema(description = "URL ảnh mô phỏng loại kho", example = "https://example.com/unit-type.jpg")
    private String imageUrl;
}
