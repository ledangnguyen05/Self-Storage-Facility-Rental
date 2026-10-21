package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.FacilityCreateRequest;
import com.boxora.dto.request.FacilityUpdateRequest;
import com.boxora.dto.response.FacilityResponse;
import com.boxora.enums.FacilityStatus;

import java.util.UUID;

public interface FacilityService {
    FacilityResponse getById(UUID id);
    FacilityResponse create(FacilityCreateRequest request);
    FacilityResponse update(UUID id, FacilityUpdateRequest request);
    void delete(UUID id);

    default PageResponse<FacilityResponse> getAll(String search, FacilityStatus status, int page, int size, String sortBy, String sortDir) {
        return getAll(search, status, page, size, sortBy, sortDir, false);
    }

    /**
     * @param publicScope {@code true} cho trang công khai (Thuê kho, trang chủ, nút liên hệ): luôn trả mọi cơ sở ĐANG HOẠT ĐỘNG,
     *                    không giới hạn theo cơ sở của nhân viên và không lộ thông tin người quản lý.
     */
    PageResponse<FacilityResponse> getAll(String search, FacilityStatus status, int page, int size, String sortBy, String sortDir, boolean publicScope);
}
