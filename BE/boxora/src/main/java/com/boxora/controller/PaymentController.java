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

    private final Map<String, String> txnFrontendUrlMap = new java.util.concurrent.ConcurrentHashMap<>();

    private String resolveClientFrontendBase(PaymentCreateRequest request, HttpServletRequest httpRequest) {
        String candidate = request != null ? request.getReturnUrl() : null;
        if (candidate == null || candidate.isBlank()) {
            candidate = httpRequest != null ? httpRequest.getHeader("Origin") : null;
        }
        if (candidate == null || candidate.isBlank()) {
            candidate = httpRequest != null ? httpRequest.getHeader("Referer") : null;
        }
        if (candidate != null && !candidate.isBlank()) {
            try {
                java.net.URI uri = java.net.URI.create(candidate.trim());
                if (uri.getScheme() != null && uri.getHost() != null) {
                    int port = uri.getPort();
                    return uri.getScheme() + "://" + uri.getHost() + (port > 0 ? ":" + port : "");
                }
            } catch (Exception ignored) {
            }
        }
        if (httpRequest != null) {
            String host = httpRequest.getServerName();
            if ("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host)) {
                return "http://localhost:5173";
            }
        }
        return frontendUrl != null && !frontendUrl.isBlank() ? frontendUrl.replaceAll("/+$", "") : "http://localhost:5173";
    }

    @PostMapping("vnpay/create")
        @Operation(summary = "Khởi tạo thanh toán qua cổng VNPay Sandbox và lấy paymentUrl")
    public ResponseEntity<ApiResponse<VNPayPaymentResponse>> createVNPayPayment(
            @Valid @RequestBody PaymentCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        VNPayPaymentResponse response = paymentService.createVNPayPayment(request, httpRequest);
        if (response != null && response.getTransactionId() != null) {
            txnFrontendUrlMap.put(response.getTransactionId(), resolveClientFrontendBase(request, httpRequest));
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Khởi tạo thanh toán VNPay thành công", response));
    }

    @GetMapping("vnpay-return")
    @Operation(summary = "Xử lý redirect từ VNPay sau khi khách hàng thanh toán (Return URL)")
    public Object handleVNPayReturn(
            @RequestParam Map<String, String> allParams,
            @RequestParam(value = "redirect", defaultValue = "true") boolean redirect,
            HttpServletRequest httpRequest
    ) {
        try {
            PaymentResponse payment = paymentService.processVNPayReturn(allParams);
            String txnRefParam = allParams != null ? allParams.get("vnp_TxnRef") : null;
            String baseFrontend = (txnRefParam != null ? txnFrontendUrlMap.get(txnRefParam) : null);
            if (baseFrontend == null || baseFrontend.isBlank()) {
                baseFrontend = resolveClientFrontendBase(null, httpRequest);
            }
            if (redirect) {
                StringBuilder targetUrl = new StringBuilder(baseFrontend + "/payment-result");
                targetUrl.append("?status=").append(payment.getStatus().name())
                        .append("&txnRef=").append(payment.getTransactionId() != null ? payment.getTransactionId() : "")
                        .append("&amount=").append(payment.getAmount() != null ? payment.getAmount() : "");
                if (payment.getBookingId() != null) {
                    targetUrl.append("&bookingId=").append(payment.getBookingId());
                }
                if (payment.getContractId() != null) {
                    targetUrl.append("&contractId=").append(payment.getContractId());
                }
                if (payment.getPaymentType() != null) {
                    targetUrl.append("&paymentType=").append(payment.getPaymentType().name());
                }
                if (payment.getId() != null) {
                    targetUrl.append("&paymentId=").append(payment.getId());
                }
                String respCode = allParams != null ? allParams.get("vnp_ResponseCode") : null;
                if (respCode != null && !respCode.isBlank()) {
                    targetUrl.append("&responseCode=").append(respCode);
                }
                return new RedirectView(targetUrl.toString());
            }
            return ResponseEntity.ok(ApiResponse.success("Thanh toán hoàn tất", payment));
        } catch (Exception e) {
            log.error("Lỗi khi xử lý VNPay return: {}", e.getMessage(), e);
            if (redirect) {
                String baseFrontend = resolveClientFrontendBase(null, httpRequest);
                String errorUrl = baseFrontend + "/payment-result?status=FAILED&error="
                        + java.net.URLEncoder.encode(e.getMessage(), java.nio.charset.StandardCharsets.UTF_8);
                String txnRefParam = allParams != null ? allParams.get("vnp_TxnRef") : null;
                if (txnRefParam != null && !txnRefParam.isBlank()) {
                    errorUrl += "&txnRef=" + txnRefParam;
                }
                String respCodeParam = allParams != null ? allParams.get("vnp_ResponseCode") : null;
                if (respCodeParam != null && !respCodeParam.isBlank()) {
                    errorUrl += "&responseCode=" + respCodeParam;
                }
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
    @PreAuthorize("hasAuthority('PAYMENT_VIEW') or hasRole('CUSTOMER') or isAuthenticated()")

    @Operation(summary = "Lấy chi tiết thanh toán theo Payment ID")
    public ResponseEntity<ApiResponse<PaymentResponse>> getById(@PathVariable UUID id) {
        PaymentResponse response = paymentService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("transaction/{transactionId}")

    @Operation(summary = "Lấy chi tiết thanh toán theo mã giao dịch VNPay (transactionId / txnRef)")
    public ResponseEntity<ApiResponse<PaymentResponse>> getByTransactionId(@PathVariable String transactionId) {
        PaymentResponse response = paymentService.getByTransactionId(transactionId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("booking/{bookingId}")

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
