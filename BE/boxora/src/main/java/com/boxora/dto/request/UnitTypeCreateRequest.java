package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnitTypeCreateRequest {

    @NotBlank(message = "Tên loại kho không được để trống")
    private String typeName;

    @NotBlank(message = "Kích thước loại kho không được để trống")
    private String dimensions;

    @NotNull(message = "Diện tích không được để trống")
    @Positive(message = "Diện tích phải lớn hơn 0")
    private Double areaSqm;

    @NotNull(message = "Đơn giá cơ sở không được để trống")
    @Positive(message = "Đơn giá cơ sở phải lớn hơn 0")
    private BigDecimal basePricePerMonth;

    @NotNull(message = "Tiền cọc không được để trống")
    @PositiveOrZero(message = "Tiền cọc không được âm")
    private BigDecimal depositAmount;
}
