package com.boxora.service;

import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.PricingQuoteResponse;

public interface PricingService {

    /**
     * Nguồn tính giá duy nhất (Single Source of Truth) theo SRS Boxora:
     * - Giá thuê theo loại kho và cơ sở
     * - Kỳ hạn tối thiểu (min 1 tháng / theo policy)
     * - Chiết khấu theo coupon/chính sách
     * - Tiền cọc bằng 1 tháng tiền thuê
     * - Tổng tiền thanh toán đợt đầu và trọn kỳ
     */
    PricingQuoteResponse calculateQuote(PricingQuoteRequest request);
}
