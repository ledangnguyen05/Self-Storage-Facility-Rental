package com.boxora.integration.smartlock;

import com.boxora.enums.PinRevocationExecutionStatus;

public interface SmartLockAdapter {

    RevocationResult revokeCredentials(String unitCode, String onlineStatus, boolean simulateOffline);

    TempGrantResult grantTemporaryPin(String unitCode, int hours);

    UnlockResult remoteUnlock(String unitCode, String reason);

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

    record UnlockResult(
            boolean success,
            boolean isMock,
            String message,
            String errorDetails
    ) {}
}


