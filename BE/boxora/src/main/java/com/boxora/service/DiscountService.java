package com.boxora.service;

import com.boxora.dto.request.DiscountCreateRequest;
import com.boxora.dto.request.DiscountUpdateRequest;
import com.boxora.dto.request.DiscountValidateRequest;
import com.boxora.dto.response.DiscountResponse;
import com.boxora.dto.response.DiscountValidateResponse;

import java.util.List;
import java.util.UUID;

public interface DiscountService {
    List<DiscountResponse> getAllDiscounts(UUID facilityId, Boolean activeOnly);
    List<DiscountResponse> getActiveDiscounts(UUID facilityId);
    DiscountResponse getDiscountById(UUID id);
    DiscountResponse getDiscountByCode(String code);
    DiscountResponse createDiscount(DiscountCreateRequest request);
    DiscountResponse updateDiscount(UUID id, DiscountUpdateRequest request);
    void deleteDiscount(UUID id);
    DiscountValidateResponse validateAndCalculateDiscount(DiscountValidateRequest request);

    /**
     * Tăng số lượt đã dùng của mã ưu đãi sau khi đặt kho thành công (nguyên tử, không vượt giới hạn).
     * Bỏ qua mã rỗng và mã chiết khấu kỳ hạn tự sinh (TERM_...). Ném DISCOUNT_USAGE_LIMIT_EXCEEDED nếu mã vừa hết lượt.
     */
    void consumeDiscount(String code);
}

