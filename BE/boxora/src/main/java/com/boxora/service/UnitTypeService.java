package com.boxora.service;

import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypePriceAdjustmentRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.dto.response.UnitTypeResponse;

import java.util.List;
import java.util.UUID;

public interface UnitTypeService {

    /**
     * Tạo mới loại kho lưu trữ (Unit Type) và ghi nhận giá niêm yết ban đầu.
     */
    UnitTypeResponse createUnitType(UnitTypeCreateRequest request);

    /**
     * Cập nhật thông tin loại kho (kích thước, diện tích, tên, tiền cọc, giá niêm yết).
     */
    UnitTypeResponse updateUnitType(UUID id, UnitTypeUpdateRequest request);

    /**
     * Điều chỉnh giá loại kho theo BR-RULE-011 (bắt buộc lý do và lưu lịch sử giá).
     */
    UnitTypeResponse adjustPrice(UUID id, UnitTypePriceAdjustmentRequest request);

    /**
     * Xóa loại kho (chỉ xóa khi không có kho nào đang thuộc loại này).
     */
    void deleteUnitType(UUID id);

    /**
     * Lấy chi tiết thông tin một loại kho theo ID.
     */
    UnitTypeResponse getById(UUID id);

    /**
     * Lấy toàn bộ danh sách loại kho có sẵn trong hệ thống (kèm số lượng kho tương ứng).
     */
    List<UnitTypeResponse> getAll();

    /**
     * Lấy lịch sử biến động giá của một loại kho.
     */
    List<StorageUnitPriceHistoryResponse> getPriceHistory(UUID id);
}

