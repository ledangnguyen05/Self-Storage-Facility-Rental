package com.boxora.service;

import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.dto.response.TermDiscountResponse;

import java.util.List;
import java.util.UUID;

public interface PricingService {

    /**
     * Nguồn tính giá duy nhất (Single Source of Truth) theo SRS Boxora:
     * - Đơn giá thuê theo chính sách cơ sở (giá riêng theo loại kho), rồi đến giá của kho, rồi giá niêm yết loại kho
     * - Kỳ hạn tối thiểu theo chính sách cơ sở (bỏ qua khi {@code renewal = true})
     * - Chiết khấu kỳ hạn 3/6/12 tháng theo bảng giá của cơ sở, hoặc mã ưu đãi nếu giảm nhiều hơn
     * - Tiền cọc = đơn giá tháng x tỷ lệ cọc của chính sách (mặc định 100%)
     * - Tổng tiền thanh toán đợt đầu và trọn kỳ
     *
     * <p>Mã ưu đãi sai ném {@code AppException(DISCOUNT_CODE_INVALID)} (HTTP 400). Chưa có đơn giá ném
     * {@code UNIT_TYPE_PRICE_NOT_CONFIGURED} (HTTP 409), không bao giờ dùng giá bịa.
     */
    PricingQuoteResponse calculateQuote(PricingQuoteRequest request);

    /** Các mốc chiết khấu kỳ hạn áp dụng cho kho (theo bảng giá của cơ sở), để hiển thị trước khi báo giá. */
    List<TermDiscountResponse> getTermDiscounts(UUID storageUnitId);
}
