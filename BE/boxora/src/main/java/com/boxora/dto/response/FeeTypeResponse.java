package com.boxora.dto.response;

import com.boxora.enums.FeeCategory;
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
@Schema(description = "Thông tin loại phí dịch vụ / phụ phí")
public class FeeTypeResponse {
    private UUID id;
    private String code;
    private String name;
    private String description;
    private BigDecimal defaultAmount;
    private FeeCategory feeCategory;
    private Boolean isRecurring;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

