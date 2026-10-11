package com.boxora.service;

import com.boxora.dto.request.FeeTypeCreateRequest;
import com.boxora.dto.request.FeeTypeUpdateRequest;
import com.boxora.dto.response.FeeTypeResponse;
import com.boxora.enums.FeeCategory;

import java.util.List;
import java.util.UUID;

public interface FeeTypeService {
    List<FeeTypeResponse> getAllFeeTypes(FeeCategory category, Boolean activeOnly);
    FeeTypeResponse getFeeTypeById(UUID id);
    FeeTypeResponse getFeeTypeByCode(String code);
    FeeTypeResponse createFeeType(FeeTypeCreateRequest request);
    FeeTypeResponse updateFeeType(UUID id, FeeTypeUpdateRequest request);
    void deleteFeeType(UUID id);
}
