package com.boxora.service;

import com.boxora.dto.request.StorageUnitCreateRequest;
import com.boxora.dto.request.StorageUnitUpdateRequest;
import com.boxora.dto.response.StorageUnitResponse;

import java.util.List;
import java.util.UUID;

public interface StorageUnitService {

    default List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status) {
        return getUnits(facilityId, floorLevel, status, false);
    }

    /**
     * @param publicScope {@code true} cho trang công khai "Thuê kho": mọi kho của các cơ sở đang hoạt động (kể cả kho đã thuê,
     *                    hiển thị dạng "Đã có người thuê"), không giới hạn theo cơ sở của nhân viên và luôn là bản rút gọn
     *                    không có thông tin người thuê.
     */
    List<StorageUnitResponse> getUnits(UUID facilityId, String floorLevel, String status, boolean publicScope);

    StorageUnitResponse getById(UUID id);

    StorageUnitResponse createUnit(StorageUnitCreateRequest request);

    StorageUnitResponse updateUnit(UUID id, StorageUnitUpdateRequest request);

    void deleteUnit(UUID id);

    StorageUnitResponse toggleMaintenance(UUID id);
}
