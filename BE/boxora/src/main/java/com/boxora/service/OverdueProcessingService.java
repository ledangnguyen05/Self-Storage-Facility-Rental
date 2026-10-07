package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.UnsealRequest;
import com.boxora.dto.response.OverdueContractDetail;
import com.boxora.dto.response.OverdueProcessResult;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.enums.SealingStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface OverdueProcessingService {

    /**
     * Quy trình Cron / Quét thủ công xử lý hợp đồng quá hạn (+1 phạt 5%, +3 khóa PIN, +7 niêm phong BR-RULE-012).
     */
    OverdueProcessResult processOverdueContracts(LocalDate referenceDate);

    /**
     * Tra cứu danh sách tổng quan các hợp đồng đang bị quá hạn hiện tại.
     */
    List<OverdueContractDetail> getOverdueContractsSummary();

    /**
     * Danh sách biên bản niêm phong kho (phân trang, lọc theo cơ sở và trạng thái).
     */
    PageResponse<SealingRecordResponse> getAllSealingRecords(UUID facilityId, SealingStatus status, int page, int size);

    /**
     * Lấy chi tiết một biên bản niêm phong kho theo ID.
     */
    SealingRecordResponse getSealingRecordById(UUID id);

    /**
     * Mở niêm phong kho lưu trữ sau khi khách hàng đã thanh toán công nợ và phí quá hạn (BR-RULE-012).
     */
    SealingRecordResponse unsealUnit(UUID sealingRecordId, UnsealRequest request);
}
