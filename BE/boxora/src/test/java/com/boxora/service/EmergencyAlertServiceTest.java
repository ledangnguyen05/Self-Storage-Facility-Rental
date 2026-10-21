package com.boxora.service;

import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.User;
import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.NotificationChannel;
import com.boxora.enums.NotificationType;
import com.boxora.enums.OverrideSeverity;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.UserRepository;
import com.boxora.service.impl.EmergencyAlertServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmergencyAlertServiceTest {

    @Mock
    private EmailService emailService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationLogRepository notificationLogRepository;
    @Mock
    private FacilityRepository facilityRepository;

    @InjectMocks
    private EmergencyAlertServiceImpl service;

    private User recipient(String name, String email) {
        User user = User.builder().fullName(name).email(email).build();
        user.setId(UUID.randomUUID());
        return user;
    }

    private void alert(UUID facilityId) {
        service.alertMasterKeyUsed(facilityId, "Boxora District 1", "Nhân viên An", "Quản lý Trí",
                MasterKeyOverrideCategory.values()[0], OverrideSeverity.values()[0], "Khóa kẹt khẩn cấp", "BB-001");
    }

    @Test
    @DisplayName("Every manager and admin gets an in-app alert plus an email when mail is configured")
    void alertsReachEveryRecipient() {
        UUID facilityId = UUID.randomUUID();
        Facility facility = Facility.builder().name("Boxora District 1").build();
        facility.setId(facilityId);
        when(userRepository.findAllByRole_NameInAndIsActiveTrue(anyList()))
                .thenReturn(List.of(recipient("Giám đốc", "bm@example.com"), recipient("Quản trị", "admin@example.com")));
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(emailService.isMailConfigured()).thenReturn(true);

        alert(facilityId);

        verify(emailService, times(2)).sendMasterKeyAlertEmail(anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), anyString(), anyString(), anyString());
        ArgumentCaptor<NotificationLog> saved = ArgumentCaptor.forClass(NotificationLog.class);
        verify(notificationLogRepository, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).allSatisfy(log -> {
            assertThat(log.getNotificationType()).isEqualTo(NotificationType.MASTER_KEY_ALERT);
            assertThat(log.getChannel()).isEqualTo(NotificationChannel.IN_APP);
            assertThat(log.getContent()).doesNotContain("chưa được gửi");
        });
    }

    @Test
    @DisplayName("Without mail configuration the alert is still visible in the notification centre and says the email was not sent")
    void alertVisibleWithoutMail() {
        when(userRepository.findAllByRole_NameInAndIsActiveTrue(anyList())).thenReturn(List.of(recipient("Giám đốc", "bm@example.com")));
        when(emailService.isMailConfigured()).thenReturn(false);

        alert(null);

        verify(emailService, never()).sendMasterKeyAlertEmail(any(), any(), any(), any(), any(), any(), any(), any(), any());
        ArgumentCaptor<NotificationLog> saved = ArgumentCaptor.forClass(NotificationLog.class);
        verify(notificationLogRepository).save(saved.capture());
        assertThat(saved.getValue().getContent()).contains("Email cảnh báo chưa được gửi");
    }

    @Test
    @DisplayName("No recipients: nothing is sent and nothing throws")
    void noRecipients() {
        when(userRepository.findAllByRole_NameInAndIsActiveTrue(anyList())).thenReturn(List.of());

        alert(UUID.randomUUID());

        verifyNoInteractions(emailService, notificationLogRepository);
    }
}
