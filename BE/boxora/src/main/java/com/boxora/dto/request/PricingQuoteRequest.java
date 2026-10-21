package com.boxora.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PricingQuoteRequest {

    @NotNull(message = "Vui lòng chọn kho cần báo giá")
    private UUID storageUnitId;

    @NotNull(message = "Vui lòng chọn thời hạn thuê")
    @Min(value = 1, message = "Thời hạn thuê tối thiểu là 1 tháng")
    @Max(value = 120, message = "Thời hạn thuê tối đa là 120 tháng")
    private Integer rentalMonths;

    private String discountCode;

    private LocalDate startDate;

    /**
     * Đặt {@code true} khi báo giá cho gia hạn hợp đồng đang có: bỏ qua kỳ hạn thuê tối thiểu của chính sách
     * (quy định đó chỉ áp dụng khi đặt kho mới). Tiền cọc đã được giữ từ hợp đồng gốc nên người gọi bỏ qua
     * {@code depositAmount} / {@code initialPaymentAmount} và chỉ lấy {@code totalRentalFee}.
     */
    private Boolean renewal;
}
