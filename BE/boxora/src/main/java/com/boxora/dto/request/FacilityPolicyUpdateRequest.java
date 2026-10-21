package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityPolicyUpdateRequest {

    private Boolean isActive;

    @DecimalMin(value = "0.0", message = "Tỷ lệ tiền cọc từ 0 đến 100%")
    @DecimalMax(value = "100.0", message = "Tỷ lệ tiền cọc từ 0 đến 100%")
    private Double depositPercentage;

    @Min(value = 0, message = "Số ngày mở gia hạn không được âm")
    @Max(value = 365, message = "Số ngày mở gia hạn tối đa 365")
    private Integer renewalWindowDays;

    @Min(value = 0, message = "Số giờ gia hạn giữ chỗ không được âm")
    @Max(value = 168, message = "Số giờ gia hạn giữ chỗ tối đa 168")
    private Integer holdGraceHours;

    @Min(value = 1, message = "Số ngày giữ chỗ tối thiểu là 1")
    @Max(value = 90, message = "Số ngày giữ chỗ tối đa 90")
    private Integer maxHoldDays;

    @Min(value = 0, message = "Số giờ không được âm")
    private Integer cancellationFullRefundHours;

    @Min(value = 0, message = "Số giờ không được âm")
    private Integer cancellationPartialRefundHours;

    @DecimalMin(value = "0.0", message = "Tỷ lệ hoàn từ 0 đến 100%")
    @DecimalMax(value = "100.0", message = "Tỷ lệ hoàn từ 0 đến 100%")
    private Double cancellationPartialRefundPercent;

    @Min(value = 0, message = "Số ngày không được âm")
    private Integer returnNoticeDays;

    @Min(value = 0, message = "Số ngày không được âm")
    private Integer depositRefundSlaDays;

    @DecimalMin(value = "0.0", message = "Phí quá hạn không được âm")
    private BigDecimal dailyLateFee;

    @Min(value = 0, message = "Số ngày không được âm")
    private Integer overdueGraceDays;

    @Min(value = 0, message = "Số ngày không được âm")
    private Integer overdueAccessDisableDays;

    @Min(value = 0, message = "Số ngày không được âm")
    private Integer overdueSealingDays;

    @Min(value = 1, message = "Thời hạn thuê tối thiểu là 1 tháng")
    @Max(value = 36, message = "Thời hạn thuê tối thiểu tối đa 36 tháng")
    private Integer minimumRentalMonths;

    /** Khi gửi lên (kể cả danh sách rỗng), thay thế toàn bộ bảng giá riêng của cơ sở. Bỏ trống = giữ nguyên. */
    @Valid
    private List<FacilityPolicyPriceRequest> prices;
}
