package com.boxora.integration.smartlock;

import com.boxora.enums.PinRevocationExecutionStatus;

public interface SmartLockAdapter {

    RevocationResult revokeCredentials(String unitCode, String onlineStatus, boolean simulateOffline);

    TempGrantResult grantTemporaryPin(String unitCode, int hours);

    boolean isMock();

    record RevocationResult(
            PinRevocationExecutionStatus status,
            boolean success,
            boolean isMock,
            String message,
            String errorDetails
    ) {}

    record TempGrantResult(
            boolean success,
            boolean isMock,
            String tempPin,
            String message
    ) {}
}

