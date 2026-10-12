package com.boxora.dto.request;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnitTypeUpdateRequest {

    private String typeName;

    private String dimensions;

    @Positive(message = "Diện tích phải lớn hơn 0")
    private Double areaSqm;

    @Positive(message = "Đơn giá cơ sở phải lớn hơn 0")
    private BigDecimal basePricePerMonth;

    @PositiveOrZero(message = "Tiền cọc không được âm")
    private BigDecimal depositAmount;

    // Reason for price adjustment (BR-RULE-011)
    private String changeReason;
}
