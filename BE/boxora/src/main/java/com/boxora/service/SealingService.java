package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.SealingCreateRequest;
import com.boxora.dto.request.SealingUnsealRequest;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.enums.SealingStatus;

import java.util.UUID;

public interface SealingService {

    /** Lập biên bản và thực hiện niêm phong kho, chuyển trạng thái sang OVERDUE_LOCKED. */
    SealingRecordResponse createSealing(SealingCreateRequest request);

    /** Mở niêm phong kho sau khi xử lý nợ hoặc có quyết định của BGĐ. */
    SealingRecordResponse unseal(UUID sealingId, SealingUnsealRequest request);

    /** Lấy chi tiết biên bản niêm phong theo ID. */
    SealingRecordResponse getById(UUID sealingId);

    /** Lấy biên bản niêm phong hiện tại của hợp đồng. */
    SealingRecordResponse getActiveSealingByContractId(UUID contractId);

    /** Lấy danh sách biên bản niêm phong phân trang theo bộ lọc. */
    PageResponse<SealingRecordResponse> getAll(UUID facilityId, SealingStatus status, int page, int size);
}
