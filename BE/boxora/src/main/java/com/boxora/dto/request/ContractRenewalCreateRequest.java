package com.boxora.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRenewalCreateRequest {

    @NotNull(message = "Cycle months is required")
    @Min(value = 1, message = "Cycle months must be at least 1")
    private Integer cycleMonths;
}
