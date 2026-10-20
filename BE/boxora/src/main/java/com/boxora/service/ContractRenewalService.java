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

    /** Khởi tạo yêu cầu gia hạn hợp đồng kèm ghi chú. */
    ContractRenewalResponse requestRenewal(UUID contractId, Integer cycleMonths, String notes);

    /** Phê duyệt yêu cầu gia hạn hợp đồng (Facility Manager / Business Manager). */
    ContractRenewalResponse approveRenewal(UUID renewalId, String notes);

    /** Từ chối yêu cầu gia hạn hợp đồng có lý do bắt buộc. */
    ContractRenewalResponse rejectRenewal(UUID renewalId, String reason);

    /** Hủy yêu cầu gia hạn hợp đồng (Customer hoặc Manager khi chưa thanh toán). */
    ContractRenewalResponse cancelRenewal(UUID renewalId);

    /** Kích hoạt duyệt lại yêu cầu gia hạn bị từ chối sau 3 ngày kể từ ngày gửi đơn ban đầu. */
    ContractRenewalResponse reactivateRenewal(UUID renewalId);

    /** Bỏ duyệt yêu cầu gia hạn để xem xét lại (chỉ áp dụng khi khách chưa ký và chưa thanh toán). */
    ContractRenewalResponse undoApproval(UUID renewalId, String reason);

    /** Phân ca / phân công nhân viên tiếp nhận khách hàng gia hạn tại cơ sở. */
    ContractRenewalResponse assignStaff(UUID renewalId, com.boxora.dto.request.ContractRenewalAssignStaffRequest request);

    /** Tiếp nhận khách hàng tới gia hạn tại quầy với quy trình đối soát 6 tiêu chí nghiêm ngặt. */
    ContractRenewalResponse completeReception(UUID renewalId, com.boxora.dto.request.ContractRenewalReceptionRequest request);

    /** Chọn hoặc thay đổi hình thức ký và thanh toán gia hạn (ONLINE hoặc COUNTER). */
    ContractRenewalResponse switchRenewalMethod(UUID renewalId, com.boxora.dto.request.ContractRenewalSwitchMethodRequest request);

    /** Ghi nhận thanh toán phí gia hạn tại quầy (tiền mặt / chuyển khoản / POS). */
    ContractRenewalResponse recordCounterPayment(UUID renewalId, com.boxora.dto.request.ContractRenewalCounterPaymentRequest request);

    /** Ký phụ lục gia hạn ở chế độ mô phỏng / local development kèm chữ ký tay. */
    ContractRenewalResponse mockSignRenewal(UUID renewalId, String signatureData);

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

    /** Lấy danh sách yêu cầu gia hạn phân trang theo bộ lọc mở rộng kèm tìm kiếm và khoảng ngày. */
    PageResponse<ContractRenewalResponse> getAllRenewals(
            UUID contractId, UUID facilityId, com.boxora.enums.ContractRenewalStatus status,
            String search, java.time.LocalDate fromDate, java.time.LocalDate toDate,
            int page, int size, String sortBy, String sortDir);
}
