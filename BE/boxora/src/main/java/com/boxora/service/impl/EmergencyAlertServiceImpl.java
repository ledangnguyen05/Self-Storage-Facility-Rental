package com.boxora.service.impl;

import com.boxora.entity.User;
import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.OverrideSeverity;
import com.boxora.repository.UserRepository;
import com.boxora.service.EmailService;
import com.boxora.service.EmergencyAlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmergencyAlertServiceImpl implements EmergencyAlertService {

    private final EmailService emailService;
    private final UserRepository userRepository;

    // BUSINESS_MANAGER is the seeded system-wide management role in Boxora
    private static final List<String> ALERT_RECIPIENT_ROLES =
            List.of("BUSINESS_MANAGER", "BUSINESS_MANAGER", "ADMIN");

    @Override
    public void alertMasterKeyUsed(UUID facilityId, String facilityName,
                                   String performedByName, String witnessName,
                                   MasterKeyOverrideCategory category, OverrideSeverity severity,
                                   String reason, String documentReference) {
        List<User> recipients = userRepository.findAllByRole_NameInAndIsActiveTrue(ALERT_RECIPIENT_ROLES);

        if (recipients.isEmpty()) {
            // Không có ai để cảnh báo vẫn phải log lại - đây là dấu hiệu thiếu cấu hình,
            // không nên để im lặng trôi qua với 1 sự kiện an ninh nghiêm trọng.
            log.warn("[MASTER_KEY_ALERT] No BUSINESS_MANAGER/ADMIN found to notify - "
                    + "facility={}, performedBy={}, witness={}, category={}, severity={}",
                    facilityName, performedByName, witnessName, category, severity);
            return;
        }

        for (User recipient : recipients) {
            try {
                emailService.sendMasterKeyAlertEmail(
                        recipient.getEmail(),
                        recipient.getFullName(),
                        facilityName,
                        performedByName,
                        witnessName,
                        category.name(),
                        severity.name(),
                        reason,
                        documentReference
                );
            } catch (Exception e) {
                // 1 email lỗi không được chặn việc gửi cho những người còn lại
                log.error("Failed to send master key alert email to {}", recipient.getEmail(), e);
            }
        }
    }
}