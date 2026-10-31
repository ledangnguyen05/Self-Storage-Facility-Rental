package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.PolicyConfirmationRequest;
import com.boxora.dto.response.CancellationPolicyDetailResponse;
import com.boxora.dto.response.PolicyConfirmationResponse;
import com.boxora.dto.response.PolicyConfirmationStatusResponse;
import com.boxora.service.CancellationPolicyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cancellation-policy")
@Tag(name = "Cancellation Policy", description = "API quản lý và xác nhận điều khoản hủy hợp đồng & hoàn tiền Boxora")
@RequiredArgsConstructor
@Slf4j
public class CancellationPolicyController {

    private final CancellationPolicyService cancellationPolicyService;

    @GetMapping("/by-facility/{facilityId}")
    @Operation(summary = "Lấy chi tiết điều khoản hủy hợp đồng và hoàn tiền theo cơ sở")
    public ResponseEntity<ApiResponse<CancellationPolicyDetailResponse>> getPolicyByFacility(
            @PathVariable UUID facilityId) {
        CancellationPolicyDetailResponse response = cancellationPolicyService.getPolicyDetailByFacilityId(facilityId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/booking/{bookingId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lấy chi tiết điều khoản hủy hợp đồng và hoàn tiền theo đơn đặt kho")
    public ResponseEntity<ApiResponse<CancellationPolicyDetailResponse>> getPolicyByBooking(
            @PathVariable UUID bookingId) {
        CancellationPolicyDetailResponse response = cancellationPolicyService.getPolicyDetailByBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/confirm")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Khách hàng xác nhận đồng ý với điều khoản hủy hợp đồng & hoàn tiền")
    public ResponseEntity<ApiResponse<PolicyConfirmationResponse>> confirmPolicy(
            @Valid @RequestBody PolicyConfirmationRequest request,
            HttpServletRequest httpRequest) {
        PolicyConfirmationResponse response = cancellationPolicyService.confirmPolicy(request, httpRequest);
        return ResponseEntity.ok(ApiResponse.success("Xác nhận điều khoản hủy hợp đồng thành công", response));
    }

    @GetMapping("/confirmation-status/{bookingId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Kiểm tra trạng thái xác nhận điều khoản hủy hợp đồng của đơn đặt kho")
    public ResponseEntity<ApiResponse<PolicyConfirmationStatusResponse>> getConfirmationStatus(
            @PathVariable UUID bookingId) {
        PolicyConfirmationStatusResponse response = cancellationPolicyService.getConfirmationStatus(bookingId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
