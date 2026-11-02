package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
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
public class StorageUnitCreateRequest {
    @NotBlank(message = "Unit code is required")
    private String unitCode;

    @NotBlank(message = "Floor level is required")
    private String floorLevel;

    @NotNull(message = "Facility ID is required")
    private UUID facilityId;

    @NotNull(message = "Unit type ID is required")
    private UUID unitTypeId;

    @NotNull(message = "Giá thuê hàng tháng không được để trống")
    @PositiveOrZero(message = "Giá thuê hàng tháng phải lớn hơn hoặc bằng 0")
    private BigDecimal pricePerMonth;

    @NotNull(message = "Diện tích ngăn kho không được để trống")
    @Positive(message = "Diện tích ngăn kho phải lớn hơn 0")
    private Double areaSqMeters;

    private String imageUrl;
}
