package com.boxora.dto.response;

import com.boxora.enums.DiscountType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thông tin chi tiết chương trình khuyến mãi / chiết khấu")
public class DiscountResponse {
    private UUID id;
    private String code;
    private String name;
    private String description;
    private DiscountType discountType;
    private BigDecimal discountValue;
    private Integer minRentalMonths;
    private BigDecimal maxDiscountAmount;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer usageLimit;
    private Integer usedCount;
    private UUID facilityId;
    private String facilityName;
    private Boolean isActive;
    private Boolean isCurrentlyValid;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
