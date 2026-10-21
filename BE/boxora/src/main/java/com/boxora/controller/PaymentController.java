package com.boxora.controller;

import com.boxora.common.response.ApiResponse;
import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.OutstandingPaymentRequest;
import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.ContractOutstandingResponse;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import com.boxora.exception.AppException;
import com.boxora.service.ContractBillingService;
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

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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

    /** Used when APP_FRONTEND_URL is not set (empty values do not trigger @Value defaults). */
    static final String DEFAULT_FRONTEND_URL = "http://localhost:5173";

    private final PaymentService paymentService;
    private final ContractBillingService contractBillingService;

    @Value("${app.frontend-url:}")
    private String frontendUrl;

    @PostMapping("vnpay/create")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Khởi tạo thanh toán VNPay cho khoản ban đầu của đơn đặt kho (số tiền do máy chủ tính)")
    public ResponseEntity<ApiResponse<VNPayPaymentResponse>> createVNPayPayment(
            @Valid @RequestBody PaymentCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        VNPayPaymentResponse response = paymentService.createVNPayPayment(request, httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã tạo liên kết thanh toán VNPay", response));
    }

    @GetMapping("contracts/{contractId}/outstanding")
    @PreAuthorize("hasAuthority('PAYMENT_VIEW') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'STAFF')")
    @Operation(summary = "Công nợ hiện tại của hợp đồng: tiền thuê các kỳ đã đến hạn, phí trễ hạn và tiền thuê thời gian quá hạn")
    public ResponseEntity<ApiResponse<ContractOutstandingResponse>> getContractOutstanding(@PathVariable UUID contractId) {
        return ResponseEntity.ok(ApiResponse.success(contractBillingService.getOutstanding(contractId)));
    }

    @PostMapping("contracts/{contractId}/outstanding/vnpay")
    @PreAuthorize("hasAuthority('PAYMENT_CREATE') or hasAnyRole('CUSTOMER', 'ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Thanh toán công nợ hợp đồng qua VNPay (có thể trả trước các tháng tiếp theo của kỳ thuê)")
    public ResponseEntity<ApiResponse<VNPayPaymentResponse>> payContractOutstanding(
            @PathVariable UUID contractId,
            @Valid @RequestBody(required = false) OutstandingPaymentRequest request,
            HttpServletRequest httpRequest
    ) {
        Integer upcomingMonths = request != null ? request.getUpcomingMonths() : null;
        VNPayPaymentResponse response = paymentService.createOutstandingPayment(contractId, upcomingMonths, httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã tạo liên kết thanh toán VNPay", response));
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
                StringBuilder target = new StringBuilder(frontendBase()).append("/payment-result")
                        .append("?status=").append(payment.getStatus().name())
                        .append("&txnRef=").append(encode(payment.getTransactionId()))
                        .append("&amount=").append(payment.getAmount() != null ? payment.getAmount().toPlainString() : "");
                if (payment.getPaymentType() != null) {
                    target.append("&type=").append(payment.getPaymentType().name());
                }
                if (payment.getBookingId() != null) {
                    target.append("&bookingId=").append(payment.getBookingId());
                }
                if (payment.getContractId() != null) {
                    target.append("&contractId=").append(payment.getContractId());
                }
                // The gateway result code lets the result page explain a failure (cancelled, insufficient funds...).
                if (payment.getStatus() == PaymentStatus.FAILED && payment.getGatewayResponseCode() != null) {
                    target.append("&code=").append(encode(payment.getGatewayResponseCode()));
                }
                return new RedirectView(target.toString());
            }
            return ResponseEntity.ok(ApiResponse.success("Thanh toán hoàn tất", payment));
        } catch (Exception e) {
            log.error("Lỗi khi xử lý VNPay return: {}", e.getMessage(), e);
            String message = e instanceof AppException
                    ? e.getMessage()
                    : "Không xác thực được kết quả thanh toán. Nếu tài khoản đã bị trừ tiền, vui lòng liên hệ Boxora.";
            if (redirect) {
                String txnRef = allParams.get("vnp_TxnRef");
                String code = allParams.get("vnp_ResponseCode");
                String errorUrl = frontendBase() + "/payment-result?status=FAILED"
                        + (txnRef != null ? "&txnRef=" + encode(txnRef) : "")
                        + (code != null && code.matches("[0-9A-Za-z]{1,10}") ? "&code=" + encode(code) : "")
                        + "&error=" + encode(message);
                return new RedirectView(errorUrl);
            }
            return ResponseEntity.badRequest().body(ApiResponse.error(message));
        }
    }

    @GetMapping("vnpay-ipn")
    @Operation(summary = "Webhook IPN nhận kết quả thanh toán bất đồng bộ từ hệ thống VNPay")
    public ResponseEntity<VNPayIpnResponse> handleVNPayIPN(@RequestParam Map<String, String> allParams) {
        log.info("Received VNPay IPN webhook: {}", allParams);
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
    @PreAuthorize("hasAuthority('PAYMENT_VIEW') or hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy chi tiết thanh toán theo Payment ID (khách hàng chỉ xem được giao dịch của mình)")
    public ResponseEntity<ApiResponse<PaymentResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getById(id)));
    }

    @GetMapping("transaction/{transactionId}")
    @PreAuthorize("hasAuthority('PAYMENT_VIEW') or hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy chi tiết thanh toán theo mã giao dịch VNPay (transactionId / txnRef)")
    public ResponseEntity<ApiResponse<PaymentResponse>> getByTransactionId(@PathVariable String transactionId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getByTransactionId(transactionId)));
    }

    @GetMapping("booking/{bookingId}")
    @PreAuthorize("hasAuthority('PAYMENT_VIEW') or hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER', 'FACILITY_MANAGER', 'BUSINESS_MANAGER')")
    @Operation(summary = "Lấy lịch sử thanh toán của một Booking")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> getByBookingId(@PathVariable UUID bookingId) {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getByBookingId(bookingId)));
    }

    @GetMapping("my-payments")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lấy toàn bộ lịch sử thanh toán của tài khoản khách hàng đang đăng nhập")
    public ResponseEntity<ApiResponse<List<PaymentResponse>>> getMyPayments() {
        return ResponseEntity.ok(ApiResponse.success(paymentService.getMyPayments()));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PAYMENT_VIEW') or hasAnyRole('ADMIN', 'FACILITY_MANAGER', 'BUSINESS_MANAGER', 'STAFF', 'CUSTOMER')")
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

    private String frontendBase() {
        String base = frontendUrl != null ? frontendUrl.trim() : "";
        if (base.isEmpty()) {
            log.warn("app.frontend-url (APP_FRONTEND_URL) is empty; redirecting VNPay results to {}", DEFAULT_FRONTEND_URL);
            base = DEFAULT_FRONTEND_URL;
        }
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value != null ? value : "", StandardCharsets.UTF_8);
    }
}
