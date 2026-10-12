package com.boxora.dto.request;

import com.boxora.enums.DiscountType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class DiscountCreateRequest {

    @NotBlank(message = "Mã khuyến mãi không được để trống")
    @Size(max = 50, message = "Mã khuyến mãi tối đa 50 ký tự")
    @Schema(description = "Mã voucher / khuyến mãi (in hoa)", example = "SUMMER2026")
    private String code;

    @NotBlank(message = "Tên chương trình không được để trống")
    @Size(max = 150, message = "Tên chương trình tối đa 150 ký tự")
    @Schema(description = "Tên chương trình ưu đãi", example = "Ưu đãi chào hè giảm 15%")
    private String name;

    @Size(max = 255, message = "Mô tả tối đa 255 ký tự")
    @Schema(description = "Mô tả điều kiện áp dụng", example = "Áp dụng cho hợp đồng thuê từ 3 tháng trở lên")
    private String description;

    @NotNull(message = "Loại chiết khấu không được để trống")
    @Schema(description = "Loại chiết khấu: PERCENTAGE, FIXED_AMOUNT, TENURE_CYCLE")
    private DiscountType discountType;

    @NotNull(message = "Giá trị chiết khấu không được để trống")
    @DecimalMin(value = "0.01", message = "Giá trị chiết khấu phải > 0")
    @Schema(description = "Giá trị (% hoặc số tiền VNĐ)", example = "15.00")
    private BigDecimal discountValue;

    @Min(value = 1, message = "Số tháng thuê tối thiểu phải >= 1")
    @Schema(description = "Số tháng thuê tối thiểu để áp dụng", example = "3")
    @Builder.Default
    private Integer minRentalMonths = 1;

    @Schema(description = "Số tiền giảm tối đa (dành cho loại PERCENTAGE)", example = "500000.00")
    private BigDecimal maxDiscountAmount;

    @NotNull(message = "Ngày bắt đầu áp dụng không được để trống")
    @Schema(description = "Ngày bắt đầu có hiệu lực", example = "2026-06-01")
    private LocalDate startDate;

    @Schema(description = "Ngày kết thúc (null nếu vô thời hạn)", example = "2026-08-31")
    private LocalDate endDate;

    @Min(value = 1, message = "Giới hạn số lượt dùng phải >= 1")
    @Schema(description = "Giới hạn số lượt sử dụng tối đa (null nếu không giới hạn)", example = "100")
    private Integer usageLimit;

    @Schema(description = "ID cơ sở áp dụng (null nếu áp dụng toàn hệ thống)")
    private UUID facilityId;

    @Schema(description = "Trạng thái kích hoạt", example = "true")
    @Builder.Default
    private Boolean isActive = true;
}

