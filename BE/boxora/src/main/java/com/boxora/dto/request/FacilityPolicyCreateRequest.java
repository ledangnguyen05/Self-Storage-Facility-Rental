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
public class FacilityPolicyCreateRequest {

    @NotNull(message = "Vui lòng chọn cơ sở áp dụng chính sách")
    private java.util.UUID facilityId;

    private Boolean isActive;

    @NotNull(message = "Nhập tỷ lệ tiền cọc")
    @DecimalMin(value = "0.0", message = "Tỷ lệ tiền cọc từ 0 đến 100%")
    @DecimalMax(value = "100.0", message = "Tỷ lệ tiền cọc từ 0 đến 100%")
    private Double depositPercentage;

    @NotNull(message = "Nhập số ngày mở gia hạn trước hạn")
    @Min(value = 0, message = "Số ngày mở gia hạn không được âm")
    @Max(value = 365, message = "Số ngày mở gia hạn tối đa 365")
    private Integer renewalWindowDays;

    /** Số giờ gia hạn sau giờ hẹn nhận kho trước khi giữ chỗ tự hết hạn. Bỏ trống = 24 giờ. */
    @Min(value = 0, message = "Số giờ gia hạn giữ chỗ không được âm")
    @Max(value = 168, message = "Số giờ gia hạn giữ chỗ tối đa 168")
    private Integer holdGraceHours;

    /** Số ngày tối đa được đặt giữ chỗ trước lịch hẹn. Bỏ trống = 14 ngày. */
    @Min(value = 1, message = "Số ngày giữ chỗ tối thiểu là 1")
    @Max(value = 90, message = "Số ngày giữ chỗ tối đa 90")
    private Integer maxHoldDays;

    @NotNull(message = "Nhập mốc hoàn 100% khi hủy")
    @Min(value = 0, message = "Số giờ không được âm")
    private Integer cancellationFullRefundHours;

    @NotNull(message = "Nhập mốc hoàn một phần khi hủy")
    @Min(value = 0, message = "Số giờ không được âm")
    private Integer cancellationPartialRefundHours;

    @NotNull(message = "Nhập tỷ lệ hoàn một phần")
    @DecimalMin(value = "0.0", message = "Tỷ lệ hoàn từ 0 đến 100%")
    @DecimalMax(value = "100.0", message = "Tỷ lệ hoàn từ 0 đến 100%")
    private Double cancellationPartialRefundPercent;

    @NotNull(message = "Nhập số ngày báo trước khi trả kho")
    @Min(value = 0, message = "Số ngày không được âm")
    private Integer returnNoticeDays;

    @NotNull(message = "Nhập SLA hoàn cọc")
    @Min(value = 0, message = "Số ngày không được âm")
    private Integer depositRefundSlaDays;

    @NotNull(message = "Nhập phí quá hạn mỗi ngày")
    @DecimalMin(value = "0.0", message = "Phí quá hạn không được âm")
    private BigDecimal dailyLateFee;

    @NotNull(message = "Nhập số ngày ân hạn quá hạn")
    @Min(value = 0, message = "Số ngày không được âm")
    private Integer overdueGraceDays;

    @NotNull(message = "Nhập số ngày khóa PIN")
    @Min(value = 0, message = "Số ngày không được âm")
    private Integer overdueAccessDisableDays;

    @NotNull(message = "Nhập số ngày niêm phong")
    @Min(value = 0, message = "Số ngày không được âm")
    private Integer overdueSealingDays;

    @NotNull(message = "Nhập thời hạn thuê tối thiểu")
    @Min(value = 1, message = "Thời hạn thuê tối thiểu là 1 tháng")
    @Max(value = 36, message = "Thời hạn thuê tối thiểu tối đa 36 tháng")
    private Integer minimumRentalMonths;

    @Valid
    private List<FacilityPolicyPriceRequest> prices;
}
