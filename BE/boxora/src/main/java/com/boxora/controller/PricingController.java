package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.PricingQuoteRequest;
import com.boxora.dto.response.PricingQuoteResponse;
import com.boxora.service.PricingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pricing")
@RequiredArgsConstructor
@Tag(name = "Pricing", description = "Single source of truth for Boxora pricing and fee quotes")
public class PricingController {

    private final PricingService pricingService;

    @PostMapping("/quote")
    @Operation(summary = "Tính toán báo giá thuê kho chuẩn xác từ máy chủ (tiền thuê, cọc, giảm giá, thanh toán đợt đầu)")
    public ResponseEntity<ApiResponse<PricingQuoteResponse>> getQuote(@Valid @RequestBody PricingQuoteRequest request) {
        PricingQuoteResponse quote = pricingService.calculateQuote(request);
        return ResponseEntity.ok(ApiResponse.success(quote));
    }
}
