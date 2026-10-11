package com.boxora.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscountValidateRequest {

    @NotBlank(message = "Mã ưu đãi không được để trống")
    @Schema(description = "Mã voucher / ưu đãi", example = "SUMMER2026")
    private String code;

    @NotNull(message = "Số tháng thuê không được để trống")
    @Min(value = 1, message = "Số tháng thuê tối thiểu là 1")
    @Schema(description = "Thời gian thuê dự kiến (tháng)", example = "6")
    private Integer rentalMonths;

    @NotNull(message = "Tổng tiền thuê gốc không được để trống")
    @DecimalMin(value = "0.0", inclusive = false, message = "Tổng tiền thuê phải > 0")
    @Schema(description = "Tổng tiền thuê gốc trước chiết khấu", example = "6000000.00")
    private BigDecimal baseAmount;

    @Schema(description = "ID cơ sở thuê kho")
    private UUID facilityId;
}

