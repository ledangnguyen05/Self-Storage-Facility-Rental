package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.BookingCancelRequest;
import com.boxora.dto.response.AutoCancelResult;
import com.boxora.dto.response.BookingCancelResponse;
import com.boxora.dto.response.BookingCancellationPreviewResponse;
import com.boxora.service.BookingCancellationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Booking Cancellation & Auto-Cancel", description = "API quản lý hủy đặt kho (Refund 3 mốc) và Auto-Cancel Cron (15 phút)")
@RequiredArgsConstructor
@Slf4j
public class BookingCancellationController {

    private final BookingCancellationService bookingCancellationService;

    @GetMapping("/bookings/{id}/cancellation-preview")
    @Operation(summary = "Xem trước thông tin hoàn tiền cọc hủy đơn theo 3 mốc (>=48h 100%, 24h-48h 50%, <24h 0%)")
    public ResponseEntity<ApiResponse<BookingCancellationPreviewResponse>> getCancellationPreview(
            @PathVariable UUID id
    ) {
        BookingCancellationPreviewResponse preview = bookingCancellationService.previewCancellationRefund(id);
        return ResponseEntity.ok(ApiResponse.success(preview));
    }

    @PostMapping("/bookings/{id}/cancel")
    @PreAuthorize("hasAuthority('BOOKING_CANCEL') or hasAuthority('BOOKING_UPDATE') or hasRole('STAFF') or hasRole('FACILITY_MANAGER') or hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Hủy đơn đặt kho, giải phóng ngăn kho và hoàn tiền cọc theo 3 mốc")
    public ResponseEntity<ApiResponse<BookingCancelResponse>> cancelBooking(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) BookingCancelRequest request
    ) {
        BookingCancelResponse response = bookingCancellationService.cancelBooking(id, request);
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }

    @PostMapping("/bookings/code/{bookingCode}/cancel")
    @PreAuthorize("hasAuthority('BOOKING_CANCEL') or hasAuthority('BOOKING_UPDATE') or hasRole('STAFF') or hasRole('FACILITY_MANAGER') or hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Hủy đơn đặt kho qua mã đặt chỗ (bookingCode)")
    public ResponseEntity<ApiResponse<BookingCancelResponse>> cancelBookingByCode(
            @PathVariable String bookingCode,
            @Valid @RequestBody(required = false) BookingCancelRequest request
    ) {
        BookingCancelResponse response = bookingCancellationService.cancelBookingByCode(bookingCode, request);
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }

    @PostMapping("/bookings/{id}/revoke-cancel")
    @PreAuthorize("hasAuthority('BOOKING_CANCEL') or hasAuthority('BOOKING_UPDATE') or hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('FACILITY_MANAGER') or hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Hủy yêu cầu trả kho / rút lại yêu cầu hủy đơn và hoàn cọc")
    public ResponseEntity<ApiResponse<BookingCancelResponse>> revokeCancellation(
            @PathVariable UUID id
    ) {
        BookingCancelResponse response = bookingCancellationService.revokeCancellation(id);
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }

    @PostMapping("/bookings/code/{bookingCode}/revoke-cancel")
    @PreAuthorize("hasAuthority('BOOKING_CANCEL') or hasAuthority('BOOKING_UPDATE') or hasRole('CUSTOMER') or hasRole('STAFF') or hasRole('FACILITY_MANAGER') or hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Hủy yêu cầu trả kho / rút lại yêu cầu hủy đơn và hoàn cọc theo mã đặt chỗ")
    public ResponseEntity<ApiResponse<BookingCancelResponse>> revokeCancellationByCode(
            @PathVariable String bookingCode
    ) {
        BookingCancelResponse response = bookingCancellationService.revokeCancellationByCode(bookingCode);
        return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
    }

    @PostMapping("/cron/auto-cancel-process")
    @PreAuthorize("hasRole('BUSINESS_MANAGER')")
    @Operation(summary = "Kích hoạt quét thủ công tự động hủy các booking PENDING_PAYMENT quá hạn thanh toán (mặc định 15 phút)")
    public ResponseEntity<ApiResponse<AutoCancelResult>> triggerAutoCancelProcess(
            @RequestParam(required = false, defaultValue = "15") Integer timeoutMinutes
    ) {
        AutoCancelResult result = bookingCancellationService.triggerAutoCancel(timeoutMinutes);
        return ResponseEntity.ok(ApiResponse.success("Đã quét và xử lý hủy tự động thành công", result));
    }
}

