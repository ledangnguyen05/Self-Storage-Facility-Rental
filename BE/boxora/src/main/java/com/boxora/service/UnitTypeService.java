package com.boxora.service;

import com.boxora.dto.request.UnitTypeCreateRequest;
import com.boxora.dto.request.UnitTypeUpdateRequest;
import com.boxora.dto.response.PriceHistoryResponse;
import com.boxora.dto.response.UnitTypeResponse;

import java.util.List;
import java.util.UUID;

public interface UnitTypeService {

    List<UnitTypeResponse> getAllUnitTypes();

    UnitTypeResponse getUnitTypeById(UUID id);

    UnitTypeResponse createUnitType(UnitTypeCreateRequest request, String currentUserEmail);

    /**
     * Updates UnitType metadata and manages price history adjustment under BR-RULE-011.
     */
    UnitTypeResponse updateUnitType(UUID id, UnitTypeUpdateRequest request, String currentUserEmail);

    void deleteUnitType(UUID id);

    List<PriceHistoryResponse> getPriceHistoriesByUnitType(UUID unitTypeId);

    List<PriceHistoryResponse> getAllPriceHistories();
}
