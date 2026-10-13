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
public class PriceHistoryResponse {
    private UUID id;
    private UUID unitTypeId;
    private String unitTypeName;
    private BigDecimal oldPrice;
    private BigDecimal newPrice;
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveTo;
    private String reason;
    private UUID changedById;
    private String changedByName;
    private LocalDateTime createdAt;
}
