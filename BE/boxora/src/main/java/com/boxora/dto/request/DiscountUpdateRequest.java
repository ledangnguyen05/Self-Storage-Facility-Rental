package com.boxora.dto.request;

import com.boxora.enums.DiscountType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscountUpdateRequest {

    @Size(max = 150, message = "Tên chương trình tối đa 150 ký tự")
    @Schema(description = "Tên chương trình ưu đãi", example = "Ưu đãi chào hè giảm 15%")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    @Schema(description = "Mô tả điều kiện áp dụng")
    private String description;

    @Schema(description = "Loại chiết khấu: PERCENTAGE, FIXED_AMOUNT, TENURE_CYCLE")
    private DiscountType discountType;

    @DecimalMin(value = "0.01", message = "Giá trị chiết khấu phải > 0")
    @Schema(description = "Giá trị (% hoặc số tiền VNĐ)")
    private BigDecimal discountValue;

    @Min(value = 1, message = "Số tháng thuê tối thiểu phải >= 1")
    @Schema(description = "Số tháng thuê tối thiểu để áp dụng")
    private Integer minRentalMonths;

    @Schema(description = "Số tiền giảm tối đa (dành cho loại PERCENTAGE)")
    private BigDecimal maxDiscountAmount;

    @Schema(description = "Ngày bắt đầu có hiệu lực")
    private LocalDate startDate;

    @Schema(description = "Ngày kết thúc")
    private LocalDate endDate;

    @Min(value = 1, message = "Giới hạn số lượt dùng phải >= 1")
    @Schema(description = "Giới hạn số lượt sử dụng tối đa")
    private Integer usageLimit;

    @Schema(description = "ID cơ sở áp dụng (null nếu áp dụng toàn hệ thống)")
    private UUID facilityId;

    @Schema(description = "Trạng thái kích hoạt")
    private Boolean isActive;
}

