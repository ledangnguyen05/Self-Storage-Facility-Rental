package com.boxora.dto.request;

import com.boxora.enums.FeeCategory;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class FeeTypeCreateRequest {

    @NotBlank(message = "Mã loại phí không được để trống")
    @Size(max = 50, message = "Mã loại phí tối đa 50 ký tự")
    @Schema(description = "Mã loại phí duy nhất", example = "CLEANING_BASIC")
    private String code;

    @NotBlank(message = "Tên loại phí không được để trống")
    @Size(max = 150, message = "Tên loại phí tối đa 150 ký tự")
    @Schema(description = "Tên loại phí", example = "Phí vệ sinh khử khuẩn kho")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    @Schema(description = "Mô tả chi tiết loại phí", example = "Chi phí vệ sinh dọn dẹp kho khi trả hoặc phát sinh bụi bẩn")
    private String description;

    @NotNull(message = "Đơn giá mặc định không được để trống")
    @DecimalMin(value = "0.0", inclusive = true, message = "Đơn giá mặc định phải >= 0")
    @Schema(description = "Số tiền phí mặc định (VNĐ)", example = "150000.00")
    private BigDecimal defaultAmount;

    @NotNull(message = "Phân loại phí không được để trống")
    @Schema(description = "Danh mục loại phí: LATE_PENALTY, CLEANING, KEY_REPLACEMENT, INSURANCE, OVERDUE_STORAGE, OTHER")
    private FeeCategory feeCategory;

    @Schema(description = "Phí có tính định kỳ theo tháng hay không", example = "false")
    @Builder.Default
    private Boolean isRecurring = false;

    @Schema(description = "Trạng thái kích hoạt", example = "true")
    @Builder.Default
    private Boolean isActive = true;
}
