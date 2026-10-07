package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.StorageUnitPriceAdjustmentRequest;
import com.boxora.dto.response.StorageUnitPriceHistoryResponse;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.UnitType;
import com.boxora.entity.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface StorageUnitPriceHistoryService {

    /**
     * Nghiệp vụ BR-RULE-011: Điều chỉnh giá thuê kho đơn lẻ.
     * - Thẩm định quyền hạn (ADMIN, BUSINESS_MANAGER, FACILITY_MANAGER scoped).
     * - Kiểm tra giá mới > 0, khác giá hiện tại, có lý do điều chỉnh bắt buộc.
     * - Ghi nhận lịch sử bất biến vào storage_unit_price_histories.
     * - Cập nhật giá trên kho (không ảnh hưởng đến hợp đồng/đặt cọc đang hoạt động - Grandfathering).
     * - Ghi nhận ActivityLog phục vụ truy vết kiểm toán.
     */
    StorageUnitPriceHistoryResponse adjustUnitPrice(UUID unitId, StorageUnitPriceAdjustmentRequest request);

    /**
     * Nghiệp vụ BR-RULE-011: Điều chỉnh giá niêm yết theo Loại kho (UnitType).
     * - Quyền hạn: ADMIN, BUSINESS_MANAGER.
     * - Bắt buộc lý do điều chỉnh, ghi nhận lịch sử bất biến.
     * - Cập nhật basePricePerMonth của UnitType và ghi ActivityLog.
     */
    StorageUnitPriceHistoryResponse adjustUnitTypePrice(UUID unitTypeId, StorageUnitPriceAdjustmentRequest request);

    /**
     * Lấy toàn bộ danh sách lịch sử biến động giá của một kho cụ thể.
     */
    List<StorageUnitPriceHistoryResponse> getPriceHistoryByUnit(UUID unitId);

    /**
     * Lấy danh sách lịch sử biến động giá của một loại kho (UnitType).
     */
    List<StorageUnitPriceHistoryResponse> getPriceHistoryByUnitType(UUID unitTypeId);

    /**
     * Tra cứu lịch sử giá có phân trang và lọc theo cơ sở / kho / loại kho.
     */
    PageResponse<StorageUnitPriceHistoryResponse> getAllPriceHistories(
            UUID facilityId, UUID unitId, UUID unitTypeId, int page, int size, String sortBy, String sortDir
    );

    /**
     * Overload giữ tương thích cũ.
     */
    PageResponse<StorageUnitPriceHistoryResponse> getAllPriceHistories(
            UUID facilityId, UUID unitId, int page, int size, String sortBy, String sortDir
    );

    /**
     * BR-RULE-011 Grandfathering Helper:
     * Lấy mức giá có hiệu lực tại một mốc thời gian cụ thể.
     */
    BigDecimal getEffectivePrice(UUID unitId, LocalDateTime targetTime);

    /**
     * Khởi tạo lịch sử giá ban đầu khi tạo kho mới.
     */
    void recordInitialPrice(StorageUnit unit, BigDecimal price, User changedBy);

    /**
     * Khởi tạo lịch sử giá ban đầu khi tạo loại kho mới.
     */
    void recordInitialUnitTypePrice(UnitType unitType, BigDecimal price, User changedBy);
}
