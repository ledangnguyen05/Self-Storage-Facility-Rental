package com.boxora.service;

import com.boxora.dto.response.RenewalReminderScanResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.NotificationLog;
import com.boxora.entity.RentalContract;
import com.boxora.entity.StorageUnit;
import com.boxora.entity.User;
import com.boxora.enums.NotificationType;
import com.boxora.enums.RentalContractStatus;
import com.boxora.repository.NotificationLogRepository;
import com.boxora.repository.RentalContractRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.NotificationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @Mock
    private RentalContractRepository rentalContractRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private ActivityLogService activityLogService;

    @Mock
    private FacilityAccessGuard facilityAccessGuard;

    @Mock
    private RequestContext requestContext;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    private User mockCustomer;
    private Facility mockFacility;
    private StorageUnit mockUnit;
    private RentalContract contract7d;
    private RentalContract contract3d;
    private RentalContract contractFar;

    @BeforeEach
    void setUp() {
        mockFacility = Facility.builder().name("Boxora Bình Thạnh").build();
        mockFacility.setId(UUID.randomUUID());

        mockUnit = StorageUnit.builder().unitCode("BT-202").facility(mockFacility).build();
        mockCustomer = User.builder().fullName("Vũ Hoàng D").email("d.vu@example.com").build();
        mockCustomer.setId(UUID.randomUUID());

        LocalDate today = LocalDate.now();

        // Hợp đồng còn đúng 7 ngày
        contract7d = RentalContract.builder()
                .contractCode("CTR-7D")
                .customer(mockCustomer)
                .facility(mockFacility)
                .unit(mockUnit)
                .monthlyFee(new BigDecimal("2000000"))
                .status(RentalContractStatus.ACTIVE)
                .endDate(today.plusDays(7))
                .build();
        contract7d.setId(UUID.randomUUID());

        // Hợp đồng còn đúng 3 ngày (khẩn cấp)
        contract3d = RentalContract.builder()
                .contractCode("CTR-3D")
                .customer(mockCustomer)
                .facility(mockFacility)
                .unit(mockUnit)
                .monthlyFee(new BigDecimal("2000000"))
                .status(RentalContractStatus.ACTIVE)
                .endDate(today.plusDays(3))
                .build();
        contract3d.setId(UUID.randomUUID());

        // Hợp đồng còn xa (30 ngày)
        contractFar = RentalContract.builder()
                .contractCode("CTR-30D")
                .customer(mockCustomer)
                .facility(mockFacility)
                .unit(mockUnit)
                .monthlyFee(new BigDecimal("2000000"))
                .status(RentalContractStatus.ACTIVE)
                .endDate(today.plusDays(30))
                .build();
        contractFar.setId(UUID.randomUUID());
    }

    @Test
    @DisplayName("scanAndSendRenewalReminders should send 7d and 3d reminders and prevent duplicate sending")
    void testScanAndSendRenewalReminders() {
        when(rentalContractRepository.findByStatus(RentalContractStatus.ACTIVE))
                .thenReturn(List.of(contract7d, contract3d, contractFar));

        // contract7d chưa gửi mốc 7d
        when(notificationLogRepository.existsByNotificationTypeAndReferenceId(eq(NotificationType.RENEWAL_REMINDER_7D), eq(contract7d.getId())))
                .thenReturn(false);

        // contract3d chưa gửi mốc 3d
        when(notificationLogRepository.existsByNotificationTypeAndReferenceId(eq(NotificationType.RENEWAL_REMINDER_3D), eq(contract3d.getId())))
                .thenReturn(false);

        RenewalReminderScanResponse response = notificationService.scanAndSendRenewalReminders();

        assertThat(response.getScannedContractsCount()).isEqualTo(3);
        assertThat(response.getSevenDayRemindersSent()).isEqualTo(1);
        assertThat(response.getThreeDayRemindersSent()).isEqualTo(1);

        // Verify emailService called twice (1 for 7d, 1 for 3d)
        verify(emailService, times(2)).sendRenewalReminderEmail(anyString(), anyString(), anyString(), anyString(), any(), anyLong(), any());
        // Verify notificationLog saved twice
        verify(notificationLogRepository, times(2)).save(any(NotificationLog.class));
    }

    @Test
    @DisplayName("scanAndSendRenewalReminders should skip contracts that have already been reminded")
    void testScanAndSendRenewalRemindersIdempotent() {
        when(rentalContractRepository.findByStatus(RentalContractStatus.ACTIVE))
                .thenReturn(List.of(contract7d));

        // contract7d ĐÃ gửi trước đó
        when(notificationLogRepository.existsByNotificationTypeAndReferenceId(eq(NotificationType.RENEWAL_REMINDER_7D), eq(contract7d.getId())))
                .thenReturn(true);

        RenewalReminderScanResponse response = notificationService.scanAndSendRenewalReminders();

        assertThat(response.getScannedContractsCount()).isEqualTo(1);
        assertThat(response.getSevenDayRemindersSent()).isEqualTo(0);

        verify(emailService, never()).sendRenewalReminderEmail(anyString(), anyString(), anyString(), anyString(), any(), anyLong(), any());
        verify(notificationLogRepository, never()).save(any(NotificationLog.class));
    }
}
