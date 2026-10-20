package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("api/v1/payments")
@Tag(name = "Payment", description = "API quản lý thanh toán và tích hợp cổng VNPay Sandbox")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;

    @Value("${app.frontend-url:https://boxora-storage.pages.dev}")
    private String frontendUrl;

    @PostMapping("vnpay/create")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE')")
    @Operation(summary = "Khởi tạo thanh toán qua cổng VNPay Sandbox và lấy paymentUrl")
    public ResponseEntity<ApiResponse<VNPayPaymentResponse>> createVNPayPayment(
            @Valid @RequestBody PaymentCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        VNPayPaymentResponse response = paymentService.createVNPayPayment(request, httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo thanh toán VNPay thành công", response));
    }

    @GetMapping("vnpay-return")
    @Operation(summary = "Xử lý redirect từ VNPay sau khi khách hàng thanh toán (Return URL)")
    public Object handleVNPayReturn(
            @RequestParam Map<String, String> allParams,
            @RequestParam(value = "redirect", defaultValue = "true") boolean redirect
    ) {
        try {
            PaymentResponse payment = paymentService.processVNPayReturn(allParams);
            if (redirect) {
                String targetUrl = frontendUrl + "/payment-result"
                        + "?status=" + payment.getStatus().name()
                        + "&txnRef=" + payment.getTransactionId()
                        + "&bookingId=" + payment.getBookingId()
                        + "&amount=" + payment.getAmount();
                return new RedirectView(targetUrl);
            }
            return ResponseEntity.ok(ApiResponse.success("Thanh toán hoàn tất", payment));
        } catch (Exception e) {
            log.error("Lỗi khi xử lý VNPay return: {}", e.getMessage(), e);
            if (redirect) {
                String errorUrl = frontendUrl + "/payment-result?status=FAILED&error="
                        + java.net.URLEncoder.encode(e.getMessage(), java.nio.charset.StandardCharsets.UTF_8);
                return new RedirectView(errorUrl);
            }
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("vnpay-ipn")
    @Operation(summary = "Webhook IPN nhận kết quả thanh toán bất đồng bộ từ hệ thống VNPay")
    public ResponseEntity<VNPayIpnResponse> handleVNPayIPN(@RequestParam Map<String, String> allParams) {
        log.info("Received VNPay IPN callback");
        VNPayIpnResponse response = paymentService.processVNPayIPN(allParams);
        return ResponseEntity.ok(response);
    }

    @GetMapping("vnpay-verify")
    @Operation(summary = "API kiểm tra và xác thực kết quả thanh toán VNPay (dành cho frontend gọi thủ công)")
    public ResponseEntity<ApiResponse<PaymentResponse>> verifyVNPayPayment(@RequestParam Map<String, String> allParams) {
        PaymentResponse response = paymentService.processVNPayReturn(allParams);
        return ResponseEntity.ok(ApiResponse.success("Xác thực thanh toán thành công", response));
    }

    @GetMapping("{id}")
    @PreAuthorize("hasAuthority('PAYMENT_VIEW')")
    @Operation(summary = "Lấy chi tiết thanh toán theo Payment ID")
    public ResponseEntity<ApiResponse<PaymentResponse>> getById(@PathVariable UUID id) {
        PaymentResponse response = paymentService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("transaction/{transactionId}")
    @PreAuthorize("hasAuthority('PAYMENT_VIEW')")
    @Operation(summary = "Lấy chi tiết thanh toán theo mã giao dịch VNPay (transactionId / txnRef)")
    public ResponseEntity<ApiResponse<PaymentResponse>> getByTransactionId(@PathVariable String transactionId) {
        PaymentResponse response = paymentService.getByTransactionId(transactionId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("booking/{bookingId}")
    @PreAuthorize("hasAuthority('PAYMENT_VIEW')")
    @Operation(summary = "Lấy lịch sử thanh toán của một Booking")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> getByBookingId(@PathVariable UUID bookingId) {
        List<PaymentResponse> response = paymentService.getByBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("my-payments")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lấy toàn bộ lịch sử thanh toán của tài khoản khách hàng đang đăng nhập")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> getMyPayments() {
        List<PaymentResponse> response = paymentService.getMyPayments();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PAYMENT_VIEW')")
    @Operation(summary = "Lấy danh sách thanh toán phân trang và lọc theo tiêu chí")
    public ResponseEntity<ApiResponse<PageResponse<PaymentResponse>>> getAll(
            @RequestParam(required = false) UUID bookingId,
            @RequestParam(required = false) UUID facilityId,
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) PaymentType paymentType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "paymentTime") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        PageResponse<PaymentResponse> response = paymentService.getAll(
                bookingId, facilityId, customerId, status, paymentType, fromDate, toDate, page, size, sortBy, sortDir
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
