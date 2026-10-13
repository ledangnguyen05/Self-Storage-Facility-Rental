package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.response.ContractRenewalResponse;
import com.boxora.dto.response.VNPayPaymentResponse;
import com.boxora.entity.Payment;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;
import java.util.UUID;

public interface ContractRenewalService {

    /** Khởi tạo yêu cầu gia hạn hợp đồng, tạo phụ lục và gửi link ký DocuSeal. */
    ContractRenewalResponse requestRenewal(UUID contractId, Integer cycleMonths);

    /** Khởi tạo thanh toán phí gia hạn hợp đồng qua cổng VNPay Sandbox. */
    VNPayPaymentResponse createRenewalPayment(UUID renewalId, HttpServletRequest httpRequest);

    /** Lấy URL ký phụ lục gia hạn DocuSeal. */
    String getRenewalSigningUrl(UUID renewalId);

    /** Xử lý khi có webhook IPN / Return xác nhận thanh toán phí gia hạn thành công. */
    void handleRenewalPaid(Payment payment);

    /** Xử lý khi khách hàng hoàn tất ký phụ lục gia hạn trên DocuSeal (qua webhook form.completed). */
    void handleRenewalSigned(UUID renewalId, String documentUrl);

    /** Lấy thông tin gia hạn theo renewalId. */
    ContractRenewalResponse getById(UUID renewalId);

    /** Lấy toàn bộ lịch sử gia hạn của một hợp đồng. */
    List<ContractRenewalResponse> getRenewalsByContractId(UUID contractId);

    /** Lấy danh sách tất cả yêu cầu gia hạn phân trang. */
    PageResponse<ContractRenewalResponse> getAllRenewals(int page, int size, String sortBy, String sortDir);

    /** Lấy danh sách yêu cầu gia hạn phân trang theo bộ lọc contractId, facilityId, status. */
    PageResponse<ContractRenewalResponse> getAllRenewals(
            UUID contractId, UUID facilityId, com.boxora.enums.ContractRenewalStatus status,
            int page, int size, String sortBy, String sortDir);
}
