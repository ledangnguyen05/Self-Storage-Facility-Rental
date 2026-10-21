package com.boxora.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** Giá thuê riêng của một loại kho tại một cơ sở, kèm chiết khấu theo kỳ hạn 3, 6 và 12 tháng. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicyPriceRequest {

    @NotNull(message = "Vui lòng chọn loại kho")
    private UUID unitTypeId;

    @NotNull(message = "Nhập đơn giá thuê mỗi tháng")
    @Positive(message = "Đơn giá thuê phải lớn hơn 0")
    private BigDecimal monthlyPrice;

    @DecimalMin(value = "0.0", message = "Chiết khấu từ 0 đến 100%")
    @DecimalMax(value = "100.0", message = "Chiết khấu từ 0 đến 100%")
    private Double discount3MonthPercent;

    @DecimalMin(value = "0.0", message = "Chiết khấu từ 0 đến 100%")
    @DecimalMax(value = "100.0", message = "Chiết khấu từ 0 đến 100%")
    private Double discount6MonthPercent;

    @DecimalMin(value = "0.0", message = "Chiết khấu từ 0 đến 100%")
    @DecimalMax(value = "100.0", message = "Chiết khấu từ 0 đến 100%")
    private Double discount12MonthPercent;
}
