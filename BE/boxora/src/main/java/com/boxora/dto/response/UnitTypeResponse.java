package com.boxora.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnitTypeResponse {
    private UUID id;
    private String typeName;
    private String dimensions;
    private Double areaSqm;
    private BigDecimal basePricePerMonth;
    private BigDecimal depositAmount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
