package com.boxora.dto.request;

import com.boxora.enums.FeeCategory;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
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
public class FeeTypeUpdateRequest {

    @Size(max = 150, message = "Tên loại phí tối đa 150 ký tự")
    @Schema(description = "Tên loại phí", example = "Phí vệ sinh khử khuẩn kho chuyên sâu")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    @Schema(description = "Mô tả chi tiết loại phí", example = "Cập nhật đơn giá mới theo quý")
    private String description;

    @DecimalMin(value = "0.0", inclusive = true, message = "Đơn giá mặc định phải >= 0")
    @Schema(description = "Số tiền phí mặc định (VNĐ)", example = "200000.00")
    private BigDecimal defaultAmount;

    @Schema(description = "Danh mục loại phí")
    private FeeCategory feeCategory;

    @Schema(description = "Phí có tính định kỳ theo tháng hay không")
    private Boolean isRecurring;

    @Schema(description = "Trạng thái kích hoạt")
    private Boolean isActive;
}

