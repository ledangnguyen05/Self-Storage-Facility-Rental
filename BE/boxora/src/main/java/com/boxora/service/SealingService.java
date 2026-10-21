package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.SealingCreateRequest;
import com.boxora.dto.request.SealingUnsealRequest;
import com.boxora.dto.response.SealingRecordResponse;
import com.boxora.enums.SealingStatus;

import java.util.UUID;

public interface SealingService {

    /**
     * Seals an overdue unit: only from the sealing day of the facility policy, with a witness of the same facility.
     * Revokes the tenant PIN/QR, locks unit and contract (OVERDUE_LOCKED) and emails the tenant.
     */
    SealingRecordResponse createSealing(SealingCreateRequest request);

    /** Removes the seal and reopens tenant access (see AccessRestorationServiceImpl). */
    SealingRecordResponse unseal(UUID sealingId, SealingUnsealRequest request);

    SealingRecordResponse getById(UUID sealingId);

    /** Active (SEALED) record of a contract, or null when there is none. */
    SealingRecordResponse getActiveSealingByContractId(UUID contractId);

    /** Active (SEALED) record of a storage unit, or null when there is none. */
    SealingRecordResponse getActiveSealingByUnitId(UUID unitId);

    PageResponse<SealingRecordResponse> getAll(UUID facilityId, SealingStatus status, int page, int size);
}
