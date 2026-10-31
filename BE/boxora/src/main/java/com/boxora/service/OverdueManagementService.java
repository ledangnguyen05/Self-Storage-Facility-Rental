package com.boxora.service;

import com.boxora.common.response.PageResponse;
import com.boxora.dto.request.OverduePinActionRequest;
import com.boxora.dto.request.OverduePinTempGrantRequest;
import com.boxora.dto.request.OverdueSealingWorkflowRequest;
import com.boxora.dto.request.OverdueSendReminderRequest;
import com.boxora.dto.response.OverdueContractDetailResponse;
import com.boxora.dto.response.OverdueContractItemResponse;
import com.boxora.dto.response.OverdueSummaryResponse;

import java.util.UUID;

public interface OverdueManagementService {

    OverdueSummaryResponse getOverdueSummary(UUID facilityId);

    PageResponse<OverdueContractItemResponse> getOverdueContracts(
            UUID facilityId,
            String stage,
            Integer minDays,
            Integer maxDays,
            String pinStatus,
            String sealingStatus,
            String searchTerm,
            Boolean isDemo,
            int page,
            int size
    );

    OverdueContractDetailResponse getOverdueContractDetail(UUID contractId);

    void sendReminder(UUID contractId, OverdueSendReminderRequest request);

    OverdueContractDetailResponse.PinRevocationDto requestPinRevocation(UUID contractId, OverduePinActionRequest request);

    OverdueContractDetailResponse.PinRevocationDto executePinRevocation(UUID contractId, OverduePinActionRequest request);

    void grantTemporaryPin(UUID contractId, OverduePinTempGrantRequest request);

    void processSealingWorkflow(UUID contractId, OverdueSealingWorkflowRequest request);

    byte[] exportOverdueCsv(UUID facilityId, String stage, String searchTerm);
}
