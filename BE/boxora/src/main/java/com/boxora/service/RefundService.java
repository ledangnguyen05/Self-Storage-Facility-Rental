package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RefundBankAccountRequest;
import com.boxora.dto.request.RefundCreateRequest;
import com.boxora.dto.request.RefundProcessRequest;
import com.boxora.dto.request.RefundReviewRequest;
import com.boxora.dto.response.RefundRequestResponse;
import com.boxora.enums.RefundStatus;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

public interface RefundService {

    /** Khởi tạo yêu cầu hoàn tiền (PENDING_REVIEW). Số tiền do máy chủ tính từ tiền cọc đã thu. */
    RefundRequestResponse createRefundRequest(RefundCreateRequest request);

    /** Duyệt hoặc từ chối yêu cầu hoàn tiền (PENDING_REVIEW -> APPROVED / REJECTED). */
    RefundRequestResponse reviewRefundRequest(UUID refundId, RefundReviewRequest request);

    /** Xác nhận đã chuyển tiền với mã giao dịch (APPROVED / PROCESSING_TRANSFER -> AWAITING_CUSTOMER_CONFIRMATION). */
    RefundRequestResponse processRefund(UUID refundId, RefundProcessRequest request);

    /** Bắt đầu chuyển tiền (APPROVED -> PROCESSING_TRANSFER). Cần tài khoản nhận tiền của khách. */
    RefundRequestResponse startTransfer(UUID refundId, com.boxora.dto.request.RefundTransferRequest request);

    /** Khách hàng xác nhận đã nhận được tiền hoàn (AWAITING_CUSTOMER_CONFIRMATION / PROCESSED -> RECONCILED). */
    RefundRequestResponse confirmCustomerReceived(UUID refundId, com.boxora.dto.request.RefundCustomerConfirmRequest request);

    /** Kế toán / Quản lý hoàn tất đối soát và đóng hồ sơ hoàn tiền (RECONCILED / AWAITING / PROCESSED -> COMPLETED). */
    RefundRequestResponse reconcileRefund(UUID refundId, com.boxora.dto.request.RefundReconcileRequest request);

    /** Khách hàng (hoặc nhân viên thay mặt) cung cấp / cập nhật tài khoản nhận hoàn tiền trước khi chuyển khoản. */
    RefundRequestResponse updateBankAccount(UUID refundId, RefundBankAccountRequest request);

    /** Tải lên ảnh / PDF minh chứng chuyển khoản hoàn tiền. */
    RefundRequestResponse attachTransferEvidence(UUID refundId, MultipartFile file);

    /** Lấy chi tiết yêu cầu hoàn tiền theo ID. */
    RefundRequestResponse getById(UUID refundId);

    /** Danh sách phân trang; {@code statusCsv} là một hoặc nhiều RefundStatus phân tách bằng dấu phẩy. */
    PageResponse<RefundRequestResponse> getAll(UUID facilityId, UUID customerId, String statusCsv, String q, int page, int size);

    /** Danh sách theo đúng một trạng thái (tương thích ngược). */
    default PageResponse<RefundRequestResponse> getAll(UUID facilityId, UUID customerId, RefundStatus status, int page, int size) {
        return getAll(facilityId, customerId, status != null ? status.name() : null, null, page, size);
    }

    /** Số yêu cầu theo từng trạng thái trong phạm vi được xem (cơ sở được phân công hoặc facilityId). */
    Map<String, Long> getStatusCounts(UUID facilityId);
}
