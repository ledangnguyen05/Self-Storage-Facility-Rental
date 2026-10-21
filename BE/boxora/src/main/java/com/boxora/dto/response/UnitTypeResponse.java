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
@Schema(description = "Phản hồi thông tin loại kho lưu trữ (Unit Type)")
public class UnitTypeResponse {

    private UUID id;
    private String typeName;
    private String dimensions;
    private Double areaSqm;
    private BigDecimal basePricePerMonth;
    private BigDecimal depositAmount;
    private Long activeUnitsCount;
    /** Giá thuê thấp nhất đang niêm yết cho loại kho này trên các kho còn trống (đã tính giá riêng của cơ sở); null nếu hết kho. */
    private BigDecimal lowestListedPrice;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

