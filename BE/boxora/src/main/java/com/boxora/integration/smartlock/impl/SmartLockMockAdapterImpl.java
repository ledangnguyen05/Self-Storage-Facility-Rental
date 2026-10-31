package com.boxora.integration.smartlock.impl;

import com.boxora.enums.PinRevocationExecutionStatus;
import com.boxora.integration.smartlock.SmartLockAdapter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

@Service
@Slf4j
public class SmartLockMockAdapterImpl implements SmartLockAdapter {

    private final SecureRandom random = new SecureRandom();

    @Override
    public RevocationResult revokeCredentials(String unitCode, String onlineStatus, boolean simulateOffline) {
        log.info("[SMARTLOCK-MOCK] Executing credential revocation on unit code: {}, onlineStatus: {}, simulateOffline: {}",
                unitCode, onlineStatus, simulateOffline);

        if (simulateOffline || "OFFLINE".equalsIgnoreCase(onlineStatus)) {
            log.warn("[SMARTLOCK-MOCK] Unit {} is OFFLINE. Cannot reach lock controller via IoT Gateway.", unitCode);
            return new RevocationResult(
                    PinRevocationExecutionStatus.FAILED_OFFLINE,
                    false,
                    true,
                    "Thiết bị SmartLock đang OFFLINE / Mất tín hiệu mạng IoT. Thu hồi thất bại, yêu cầu nhân viên cơ sở kiểm tra hiện trường.",
                    "ERR_SMARTLOCK_DEVICE_UNREACHABLE"
            );
        }

        return new RevocationResult(
                PinRevocationExecutionStatus.SUCCESS_MOCK,
                true,
                true,
                "Đã thu hồi mã PIN và mã QR thành công trên SmartLock IoT Gateway [MOCK ADAPTER] cho buồng kho " + unitCode,
                null
        );
    }

    @Override
    public TempGrantResult grantTemporaryPin(String unitCode, int hours) {
        int pinNumber = 100000 + random.nextInt(900000);
        String tempPin = String.valueOf(pinNumber);
        log.info("[SMARTLOCK-MOCK] Generated temporary PIN {} for unit {} valid for {} hours", tempPin, unitCode, hours);
        return new TempGrantResult(
                true,
                true,
                tempPin,
                "Đã cấp mã PIN tạm thời [MOCK ADAPTER] thành công, có hiệu lực trong " + hours + " giờ."
        );
    }

    @Override
    public boolean isMock() {
        return true;
    }
}

