package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.DiscountCreateRequest;
import com.boxora.dto.request.DiscountUpdateRequest;
import com.boxora.dto.request.DiscountValidateRequest;
import com.boxora.dto.response.DiscountResponse;
import com.boxora.dto.response.DiscountValidateResponse;
import com.boxora.service.DiscountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/discounts")
@Tag(name = "Discounts & Vouchers", description = "API quản lý chương trình khuyến mãi, chiết khấu và voucher ưu đãi (Discounts)")
@RequiredArgsConstructor
@Slf4j
public class DiscountController {

    private final DiscountService discountService;

    @GetMapping
    @Operation(summary = "Lấy danh sách tất cả chương trình ưu đãi (lọc theo cơ sở hoặc trạng thái)")
    public ResponseEntity<ApiResponse<List<DiscountResponse>>> getAllDiscounts(
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false, defaultValue = "false") Boolean activeOnly
    ) {
        List<DiscountResponse> list = discountService.getAllDiscounts(facilityId, activeOnly);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/active")
    @Operation(summary = "Lấy danh sách các ưu đãi đang có hiệu lực hiện tại (dành cho khách hàng/đặt kho)")
    public ResponseEntity<ApiResponse<List<DiscountResponse>>> getActiveDiscounts(
            @RequestParam(required = false) UUID facilityId
    ) {
        List<DiscountResponse> list = discountService.getActiveDiscounts(facilityId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Xem chi tiết chương trình ưu đãi theo ID")
    public ResponseEntity<ApiResponse<DiscountResponse>> getDiscountById(@PathVariable UUID id) {
        DiscountResponse response = discountService.getDiscountById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/by-code/{code}")
    @Operation(summary = "Tìm chương trình ưu đãi theo mã code")
    public ResponseEntity<ApiResponse<DiscountResponse>> getDiscountByCode(@PathVariable String code) {
        DiscountResponse response = discountService.getDiscountByCode(code);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Tạo mới chương trình khuyến mãi / voucher (ADMIN, BUSINESS_MANAGER)")
    public ResponseEntity<ApiResponse<DiscountResponse>> createDiscount(
            @Valid @RequestBody DiscountCreateRequest request
    ) {
        DiscountResponse response = discountService.createDiscount(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo chương trình ưu đãi thành công", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Cập nhật chương trình khuyến mãi / voucher (ADMIN, BUSINESS_MANAGER)")
    public ResponseEntity<ApiResponse<DiscountResponse>> updateDiscount(
            @PathVariable UUID id,
            @Valid @RequestBody DiscountUpdateRequest request
    ) {
        DiscountResponse response = discountService.updateDiscount(id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật chương trình ưu đãi thành công", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BUSINESS_MANAGER')")
    @Operation(summary = "Vô hiệu hóa chương trình ưu đãi (ADMIN, BUSINESS_MANAGER)")
    public ResponseEntity<ApiResponse<Void>> deleteDiscount(@PathVariable UUID id) {
        discountService.deleteDiscount(id);
        return ResponseEntity.ok(ApiResponse.success("Đã vô hiệu hóa chương trình ưu đãi thành công", null));
    }

    @PostMapping("/validate")
    @Operation(summary = "Kiểm tra và tính toán giảm giá khi khách nhập mã voucher")
    public ResponseEntity<ApiResponse<DiscountValidateResponse>> validateDiscount(
            @Valid @RequestBody DiscountValidateRequest request
    ) {
        DiscountValidateResponse response = discountService.validateAndCalculateDiscount(request);
        return ResponseEntity.ok(ApiResponse.success("Mã ưu đãi hợp lệ", response));
    }
}
