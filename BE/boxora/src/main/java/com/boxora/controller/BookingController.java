package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.dto.request.BookingCreateRequest;
import com.boxora.dto.request.BookingDecisionRequest;
import com.boxora.dto.request.BookingRescheduleRequest;
import com.boxora.dto.request.UpdatePinRequest;
import com.boxora.dto.response.BookingAccessCredentialsResponse;
import com.boxora.dto.response.BookingPinResponse;
import com.boxora.dto.response.BookingRescheduleEligibilityResponse;
import com.boxora.dto.response.BookingRescheduleHistoryResponse;
import com.boxora.dto.response.BookingRescheduleResponse;
import com.boxora.dto.response.BookingResponse;
import com.boxora.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
@Tag(name = "Booking & Access Credentials", description = "Quản lý đặt kho và mã PIN bảo mật AES-256-GCM")
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    @PreAuthorize("hasAuthority('BOOKING_CREATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Tạo lượt đặt kho kèm phát hành mã PIN bảo mật")
    public ResponseEntity<ApiResponse<BookingResponse>> create(@Valid @RequestBody BookingCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Booking created with access credentials", bookingService.createBooking(request)));
    }

@GetMapping("/my-requests")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'ADMIN')")
    @Operation(summary = "Lấy các yêu cầu đặt kho đang chờ duyệt hoặc chờ thanh toán")
    public ResponseEntity<ApiResponse<List<BookingResponse>>> getMyRequests() {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getMyBookingRequests()));
    }

    @GetMapping("/pending-approval")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy yêu cầu đặt kho đang chờ quản lý duyệt")
    public ResponseEntity<ApiResponse<List<BookingResponse>>> getPendingApprovalRequests() {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getPendingApprovalRequests()));
    }

    @PostMapping("/{id}/decision")
    @PreAuthorize("hasAuthority('BOOKING_UPDATE') or hasAnyRole('ADMIN', 'BUSINESS_MANAGER', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Duyệt hoặc từ chối yêu cầu thuê kho và phân công nhân viên chuẩn bị")
    public ResponseEntity<ApiResponse<BookingResponse>> decideRequest(
            @PathVariable UUID id,
            @Valid @RequestBody BookingDecisionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                bookingService.reviewBookingRequest(id, request.getApproved(), request.getAssignedStaffId(), request.getNotes())
        ));
    }

    @GetMapping("/my-bookings")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy toàn bộ lịch sử các lượt đặt kho của khách hàng")
    public ResponseEntity<ApiResponse<List<BookingResponse>>> getMyBookings(@RequestParam(required = false) UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getMyBookings(customerId)));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Truy vấn danh sách đơn đặt kho")
    public ResponseEntity<ApiResponse<List<BookingResponse>>> getAll(
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) com.boxora.enums.BookingStatus status) {
        List<BookingResponse> list = bookingService.getMyBookings(customerId);
        if (status != null) {
            list = list.stream().filter(b -> b.getStatus() == status).toList();
        }
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/my-active")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy danh sách các lượt đặt kho đang hoạt động")
    public ResponseEntity<ApiResponse<List<BookingResponse>>> getMyActive(@RequestParam(required = false) UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getMyActiveBookings(customerId)));
    }

    @GetMapping("/arrivals")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Danh sách khách sắp đến nhận kho")
    public ResponseEntity<ApiResponse<List<BookingResponse>>> getArrivals() {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getUpcomingArrivals()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy chi tiết lượt đặt kho (Mã PIN bị ẩn '******' để bảo mật)")
    public ResponseEntity<ApiResponse<BookingResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getById(id)));
    }

    @GetMapping("/{id}/access-credentials")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy mã PIN và QR access token của lượt đặt kho")
    public ResponseEntity<ApiResponse<BookingAccessCredentialsResponse>> getAccessCredentials(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getAccessCredentials(id)));
    }

    @GetMapping("/{id}/access-pin")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "API xem mã PIN giải mã AES-256-GCM (Chỉ chủ sở hữu hoặc nhân viên/quản lý có thẩm quyền)")
    public ResponseEntity<ApiResponse<BookingPinResponse>> getBookingPin(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(ApiResponse.success(
                "Mã PIN giải mã AES-256-GCM thành công",
                bookingService.getBookingPin(id, email)
        ));
    }

    @PutMapping("/{id}/access-pin")
    @PreAuthorize("hasAuthority('BOOKING_UPDATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "API cập nhật mã PIN mới (Tự động mã hóa AES-256-GCM và ghi audit log)")
    public ResponseEntity<ApiResponse<BookingPinResponse>> updateBookingPin(
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePinRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(ApiResponse.success(
                "Đã đổi mã PIN và mã hóa AES-256-GCM thành công",
                bookingService.updateBookingPin(id, request, email)
        ));
    }

    @GetMapping("/unit/{unitId}/access-pin")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "API tra cứu mã PIN giải mã AES-256-GCM theo mã ID phòng kho")
    public ResponseEntity<ApiResponse<BookingPinResponse>> getBookingPinByUnit(
            @PathVariable UUID unitId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(ApiResponse.success(
                "Tra cứu mã PIN phòng kho thành công",
                bookingService.getBookingPinByUnitId(unitId, email)
        ));
    }

    @PutMapping("/unit/{unitId}/access-pin")
    @PreAuthorize("hasAuthority('BOOKING_UPDATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "API cập nhật hoặc tái cấp mã PIN mã hóa AES-256-GCM theo phòng kho")
    public ResponseEntity<ApiResponse<BookingPinResponse>> updateBookingPinByUnit(
            @PathVariable UUID unitId,
            @Valid @RequestBody UpdatePinRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email = userDetails != null ? userDetails.getUsername() : null;
        return ResponseEntity.ok(ApiResponse.success(
                "Đã đổi mã PIN và mã hóa AES-256-GCM thành công cho phòng kho",
                bookingService.updateBookingPinByUnitId(unitId, request, email)
        ));
    }

    @PostMapping("/{id}/renew")
    @PreAuthorize("hasAuthority('BOOKING_UPDATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Gia hạn thời gian thuê của lượt đặt kho")
    public ResponseEntity<ApiResponse<BookingResponse>> renew(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "1") int extraMonths
    ) {
        return ResponseEntity.ok(ApiResponse.success("Contract renewed successfully", bookingService.renewBooking(id, extraMonths)));
    }

    @PostMapping("/{id}/remote-unlock")
    @PreAuthorize("hasAuthority('BOOKING_UPDATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Mở khóa từ xa qua IoT SmartLock")
    public ResponseEntity<ApiResponse<BookingResponse>> remoteUnlock(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Remote unlock signal dispatched to SmartLock IoT", bookingService.remoteUnlock(id)));
    }

    @GetMapping("/{id}/reschedule-eligibility")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Kiểm tra điều kiện đổi lịch hẹn nhận kho của khách hàng")
    public ResponseEntity<ApiResponse<BookingRescheduleEligibilityResponse>> getRescheduleEligibility(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getRescheduleEligibility(id)));
    }

    @PostMapping("/{id}/reschedule")
    @PreAuthorize("hasAuthority('BOOKING_UPDATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Đổi lịch hẹn nhận kho (kèm phản hồi chi tiết và lịch sử kiểm toán)")
    public ResponseEntity<ApiResponse<BookingRescheduleResponse>> rescheduleDetailed(
            @PathVariable UUID id,
            @Valid @RequestBody BookingRescheduleRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đổi lịch hẹn nhận kho thành công. Hạn giữ chỗ mới đã được cập nhật.",
                bookingService.rescheduleBookingDetailed(id, request)
        ));
    }

    @PutMapping("/{id}/reschedule")
    @PreAuthorize("hasAuthority('BOOKING_UPDATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Đổi lịch hẹn nhận kho và tính lại thời hạn giữ chỗ theo chính sách (Legacy)")
    public ResponseEntity<ApiResponse<BookingResponse>> reschedule(
            @PathVariable UUID id,
            @Valid @RequestBody BookingRescheduleRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đổi lịch hẹn nhận kho thành công. Hạn giữ chỗ mới đã được cập nhật.",
                bookingService.rescheduleBooking(id, request)
        ));
    }

    @GetMapping("/{id}/reschedule-history")
    @PreAuthorize("hasAuthority('BOOKING_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'STAFF')")
    @Operation(summary = "Lấy lịch sử các lần đổi lịch hẹn nhận kho (Append-only)")
    public ResponseEntity<ApiResponse<List<BookingRescheduleHistoryResponse>>> getRescheduleHistory(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(bookingService.getRescheduleHistory(id)));
    }
}
