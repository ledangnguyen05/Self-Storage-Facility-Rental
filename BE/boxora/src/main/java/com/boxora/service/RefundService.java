package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RefundCreateRequest;
import com.boxora.dto.request.RefundProcessRequest;
import com.boxora.dto.request.RefundReviewRequest;
import com.boxora.dto.response.FileUploadResponse;
import com.boxora.dto.response.RefundRequestResponse;
import com.boxora.enums.RefundStatus;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface RefundService {

    /** Tải lên ảnh chứng từ / ủy nhiệm chi hoàn tiền. */
    FileUploadResponse uploadProofImage(MultipartFile file);

    /** Khởi tạo yêu cầu hoàn tiền (PENDING_REVIEW). */
    RefundRequestResponse createRefundRequest(RefundCreateRequest request);

    /** Duyệt hoặc từ chối yêu cầu hoàn tiền (PENDING_REVIEW -> APPROVED / REJECTED). */
    RefundRequestResponse reviewRefundRequest(UUID refundId, RefundReviewRequest request);

    /** Xử lý chi trả tiền hoàn thành công (APPROVED / PROCESSING_TRANSFER -> AWAITING_CUSTOMER_CONFIRMATION / PROCESSED). */
    RefundRequestResponse processRefund(UUID refundId, RefundProcessRequest request);

    /** Bắt đầu xử lý chuyển tiền (APPROVED -> PROCESSING_TRANSFER). */
    RefundRequestResponse startTransfer(UUID refundId, com.boxora.dto.request.RefundTransferRequest request);

    /** Khách hàng xác nhận đã nhận được tiền hoàn vào tài khoản (AWAITING_CUSTOMER_CONFIRMATION / PROCESSED -> RECONCILED). */
    RefundRequestResponse confirmCustomerReceived(UUID refundId, com.boxora.dto.request.RefundCustomerConfirmRequest request);

    /** Kế toán / Quản lý hoàn tất đối soát và đóng hồ sơ hoàn tiền (RECONCILED / PROCESSED -> COMPLETED). */
    RefundRequestResponse reconcileRefund(UUID refundId, com.boxora.dto.request.RefundReconcileRequest request);

    /** Lấy chi tiết yêu cầu hoàn tiền theo ID. */
    RefundRequestResponse getById(UUID refundId);

    /** Lấy danh sách yêu cầu hoàn tiền phân trang theo bộ lọc. */
    PageResponse<RefundRequestResponse> getAll(UUID facilityId, UUID customerId, RefundStatus status, int page, int size);
}
