package com.boxora.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TermDiscountResponse {
    /** Thuê từ số tháng này trở lên được giảm. */
    private Integer months;
    /** Phần trăm giảm trên tổng tiền thuê. */
    private Double percent;
}
