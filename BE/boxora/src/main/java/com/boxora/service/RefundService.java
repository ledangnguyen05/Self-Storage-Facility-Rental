package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.RefundCreateRequest;
import com.boxora.dto.request.RefundProcessRequest;
import com.boxora.dto.request.RefundReviewRequest;
import com.boxora.dto.response.RefundRequestResponse;
import com.boxora.enums.RefundStatus;

import java.util.UUID;

public interface RefundService {

    /** Khởi tạo yêu cầu hoàn tiền (PENDING_REVIEW). */
    RefundRequestResponse createRefundRequest(RefundCreateRequest request);

    /** Duyệt hoặc từ chối yêu cầu hoàn tiền (PENDING_REVIEW -> APPROVED / REJECTED). */
    RefundRequestResponse reviewRefundRequest(UUID refundId, RefundReviewRequest request);

    /** Xử lý chi trả tiền hoàn thành công (APPROVED -> PROCESSED). */
    RefundRequestResponse processRefund(UUID refundId, RefundProcessRequest request);

    /** Lấy chi tiết yêu cầu hoàn tiền theo ID. */
    RefundRequestResponse getById(UUID refundId);

    /** Lấy danh sách yêu cầu hoàn tiền phân trang theo bộ lọc. */
    PageResponse<RefundRequestResponse> getAll(UUID facilityId, UUID customerId, RefundStatus status, int page, int size);
}
