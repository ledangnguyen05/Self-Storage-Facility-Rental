package com.boxora.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Phản hồi thông tin lịch sử giá kho theo BR-RULE-011")
public class StorageUnitPriceHistoryResponse {

    private UUID id;
    private UUID storageUnitId;
    private String unitCode;
    private UUID facilityId;
    private String facilityName;
    private UUID unitTypeId;
    private String unitTypeName;
    private BigDecimal oldPrice;
    private BigDecimal newPrice;
    private LocalDateTime effectiveFrom;
    private String reason;
    private UUID changedById;
    private String changedByName;
    private LocalDateTime createdAt;
}

