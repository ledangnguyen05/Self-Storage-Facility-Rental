package com.boxora.service;

import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.OverrideSeverity;

import java.util.UUID;

public interface EmergencyAlertService {
    /** Sends a real-time alert to Business Managers and Admins about a Master Key use. */
    void alertMasterKeyUsed(UUID facilityId, String facilityName,
                            String performedByName, String witnessName,
                            MasterKeyOverrideCategory category, OverrideSeverity severity,
                            String reason, String documentReference);
}