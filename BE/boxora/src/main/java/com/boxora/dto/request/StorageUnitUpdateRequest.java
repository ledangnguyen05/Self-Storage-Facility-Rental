package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageUnitUpdateRequest {

    @NotBlank(message = "Unit code is required")
    private String unitCode;

    @NotBlank(message = "Floor level is required")
    private String floorLevel;

    @NotNull(message = "Unit type ID is required")
    private UUID unitTypeId;

    private java.math.BigDecimal pricePerMonth;

    private String priceChangeReason;

    private String imageUrl;
}
