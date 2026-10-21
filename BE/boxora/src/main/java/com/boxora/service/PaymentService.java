package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.PaymentCreateRequest;
import com.boxora.dto.response.PaymentResponse;
import com.boxora.dto.response.VNPayIpnResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.RentalContract;
import com.boxora.enums.PaymentStatus;
import com.boxora.enums.PaymentType;
import jakarta.servlet.http.HttpServletRequest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PaymentService {

    /**
     * Khởi tạo giao dịch thanh toán qua cổng VNPay Sandbox.
     * Tạo bản ghi Payment ở trạng thái PENDING và trả về paymentUrl để chuyển hướng khách hàng.
     */
    VNPayPaymentResponse createVNPayPayment(PaymentCreateRequest request, HttpServletRequest httpRequest);

    /**
     * Xử lý kết quả trả về khi khách hàng hoàn tất thanh toán trên VNPay (Return URL redirect).
     */
    PaymentResponse processVNPayReturn(Map<String, String> params);

    /**
     * Xử lý webhook IPN (Instant Payment Notification) từ server VNPay.
     * Cập nhật trạng thái Payment / Booking và trả về format JSON chuẩn của VNPay.
     */
    VNPayIpnResponse processVNPayIPN(Map<String, String> params);

    /**
     * Lấy thông tin thanh toán theo ID.
     */
    PaymentResponse getById(UUID id);

    /**
     * Lấy thông tin thanh toán theo mã giao dịch (vnp_TxnRef / transactionId).
     */
    PaymentResponse getByTransactionId(String transactionId);

    /**
     * Lấy danh sách lịch sử thanh toán của một booking.
     */
    List<PaymentResponse> getByBookingId(UUID bookingId);

    /**
     * Lấy toàn bộ lịch sử thanh toán của tài khoản khách hàng đang đăng nhập.
     */
    List<PaymentResponse> getMyPayments();

    /**
     * Danh sách thanh toán phân trang và lọc theo tiêu chí.
     */
    PageResponse<PaymentResponse> getAll(
            UUID bookingId,
            UUID facilityId,
            UUID customerId,
            PaymentStatus status,
            PaymentType paymentType,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            int page,
            int size,
            String sortBy,
            String sortDir
    );

    /**
     * Payment of a contract (renewal fee, outstanding rent / overdue settlement). The amount and its
     * breakdown are computed by the caller on the server; {@code extensionDays} moves the contract end
     * date when an overdue settlement is paid.
     */
    VNPayPaymentResponse createContractPayment(
            RentalContract contract, com.boxora.entity.Booking booking, PaymentType type, BigDecimal amount, Integer renewalMonths,
            BigDecimal lateFeeAmount, BigDecimal overdueRentAmount, int extensionDays,
            String orderInfo, HttpServletRequest httpRequest);

    /** VNPay payment of what a contract owes today (+ optional upcoming months), computed server-side. */
    VNPayPaymentResponse createOutstandingPayment(UUID contractId, Integer upcomingMonths, HttpServletRequest httpRequest);

    VNPayPaymentResponse createContractPayment(
            RentalContract contract, PaymentType type, BigDecimal amount,
            Integer renewalMonths, String orderInfo, HttpServletRequest httpRequest);
}
