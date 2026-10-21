package com.boxora.service;

import com.boxora.dto.request.MasterKeyOverrideRequest;
import com.boxora.dto.response.MasterKeyOverrideResponse;
import com.boxora.entity.Facility;
import com.boxora.entity.MasterKeyOverride;
import com.boxora.entity.Role;
import com.boxora.entity.User;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.MasterKeyOverrideCategory;
import com.boxora.enums.OverrideSeverity;
import com.boxora.exception.AppException;
import com.boxora.exception.ErrorCode;
import com.boxora.mapper.MasterKeyOverrideMapper;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.MasterKeyOverrideRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.security.RequestContext;
import com.boxora.service.impl.MasterKeyLabels;
import com.boxora.service.impl.MasterKeyOverrideServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MasterKeyOverrideServiceTest {

    @Mock private MasterKeyOverrideRepository masterKeyOverrideRepository;
    @Mock private FacilityRepository facilityRepository;
    @Mock private UserRepository userRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private MasterKeyOverrideMapper masterKeyOverrideMapper;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private RequestContext requestContext;
    @Mock private ActivityLogService activityLogService;
    @Mock private EmergencyAlertService emergencyAlertService;

    private MasterKeyOverrideServiceImpl service;
    private Facility facility;
    private User performer;
    private User witness;

    @BeforeEach
    void setUp() {
        service = new MasterKeyOverrideServiceImpl(masterKeyOverrideRepository, facilityRepository, userRepository,
                storageUnitRepository, passwordEncoder, masterKeyOverrideMapper, facilityAccessGuard, requestContext,
                activityLogService, emergencyAlertService);

        facility = Facility.builder().name("Boxora District 1").code("D1").build();
        facility.setId(UUID.randomUUID());
        performer = User.builder().fullName("Quản lý Một").role(Role.builder().name("FACILITY_MANAGER").build())
                .facility(facility).isActive(true).password("hash-performer").build();
        performer.setId(UUID.randomUUID());
        witness = User.builder().fullName("Đinh Thị Thảo").role(Role.builder().name("STAFF").build())
                .facility(facility).isActive(true).password("hash-witness").build();
        witness.setId(UUID.randomUUID());

        when(facilityRepository.findById(facility.getId())).thenReturn(Optional.of(facility));
        when(requestContext.currentUserId()).thenReturn(performer.getId());
        when(userRepository.findById(performer.getId())).thenReturn(Optional.of(performer));
        when(userRepository.findById(witness.getId())).thenReturn(Optional.of(witness));
        when(passwordEncoder.matches("sai-mat-khau", "hash-witness")).thenReturn(false);
        when(passwordEncoder.matches("123456", "hash-witness")).thenReturn(true);
        when(masterKeyOverrideRepository.save(any(MasterKeyOverride.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(masterKeyOverrideMapper.toResponse(any(MasterKeyOverride.class))).thenReturn(new MasterKeyOverrideResponse());
    }

    private MasterKeyOverrideRequest request(String witnessPassword) {
        return MasterKeyOverrideRequest.builder()
                .facilityId(facility.getId())
                .category(MasterKeyOverrideCategory.LIFE_AND_SAFETY)
                .severity(OverrideSeverity.CRITICAL)
                .witnessUserId(witness.getId())
                .witnessPassword(witnessPassword)
                .reason("Rò rỉ nước tại hành lang tầng 1")
                .build();
    }

    @Test
    @DisplayName("Wrong witness password is a 400 business error with a Vietnamese message, never a 401 that clients replay")
    void wrongWitnessPasswordIsNotUnauthorized() {
        AppException ex = assertThrows(AppException.class, () -> service.create(request("sai-mat-khau")));

        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.MASTER_KEY_WITNESS_INVALID_CREDENTIALS);
        assertThat(ex.getErrorCode().getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(ex.getErrorCode().getHttpStatus()).isNotEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(ex.getMessage()).isEqualTo("Mật khẩu người chứng kiến không đúng");
        assertThat(ErrorCode.MASTER_KEY_WITNESS_INVALID_CREDENTIALS.getMessage()).isEqualTo("Mật khẩu người chứng kiến không đúng");
        verify(masterKeyOverrideRepository, never()).save(any(MasterKeyOverride.class));
        verify(activityLogService).record(eq(facility.getId()), eq(ActivityAction.MASTER_KEY_OVERRIDE), eq("User"),
                eq(witness.getId()), anyString(), isNull(), eq("WITNESS_VERIFICATION_FAILED"));
    }

    @Test
    @DisplayName("Each wrong attempt counts once: five wrong attempts lock the pair, the sixth is refused even with the right password")
    void fiveWrongAttemptsLockOut() {
        for (int attempt = 1; attempt <= 5; attempt++) {
            AppException ex = assertThrows(AppException.class, () -> service.create(request("sai-mat-khau")));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.MASTER_KEY_WITNESS_INVALID_CREDENTIALS);
        }

        AppException locked = assertThrows(AppException.class, () -> service.create(request("123456")));
        assertThat(locked.getErrorCode()).isEqualTo(ErrorCode.MASTER_KEY_TOO_MANY_ATTEMPTS);
        assertThat(locked.getErrorCode().getHttpStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    @DisplayName("Four wrong attempts do not lock; a correct password then records the use and clears the counter")
    void fourWrongAttemptsStillAllowTheRightPassword() {
        for (int attempt = 1; attempt <= 4; attempt++) {
            assertThrows(AppException.class, () -> service.create(request("sai-mat-khau")));
        }

        assertThat(service.create(request("123456"))).isNotNull();
        verify(masterKeyOverrideRepository).save(any(MasterKeyOverride.class));

        // The counter was cleared by the success: four more wrong attempts are still not a lockout.
        for (int attempt = 1; attempt <= 4; attempt++) {
            AppException ex = assertThrows(AppException.class, () -> service.create(request("sai-mat-khau")));
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.MASTER_KEY_WITNESS_INVALID_CREDENTIALS);
        }
    }

    @Test
    @DisplayName("The audit entry and the alert use Vietnamese labels, never raw enum codes")
    void auditEntryHasNoRawEnumCodes() {
        service.create(request("123456"));

        ArgumentCaptor<String> description = ArgumentCaptor.forClass(String.class);
        verify(activityLogService).record(eq(facility.getId()), eq(ActivityAction.MASTER_KEY_OVERRIDE), eq("STORAGE_UNIT"),
                any(UUID.class), description.capture(), isNull(), any());
        assertThat(description.getValue())
                .contains("chìa khóa tổng")
                .contains("An toàn tính mạng, cháy nổ, rò rỉ")
                .contains("khẩn cấp")
                .doesNotContain("LIFE_AND_SAFETY")
                .doesNotContain("CRITICAL");
    }

    @Test
    @DisplayName("Labels cover every category and severity and fall back to the given text for unknown names")
    void labels() {
        for (MasterKeyOverrideCategory category : MasterKeyOverrideCategory.values()) {
            assertThat(MasterKeyLabels.category(category)).isNotBlank().doesNotContain("_");
            assertThat(MasterKeyLabels.category(category.name())).isEqualTo(MasterKeyLabels.category(category));
        }
        for (OverrideSeverity severity : OverrideSeverity.values()) {
            assertThat(MasterKeyLabels.severity(severity)).isNotBlank().doesNotContain("_");
            assertThat(MasterKeyLabels.severity(severity.name())).isEqualTo(MasterKeyLabels.severity(severity));
        }
        assertThat(MasterKeyLabels.severity("SOMETHING_ELSE")).isEqualTo("SOMETHING_ELSE");
        assertThat(MasterKeyLabels.category((String) null)).isEqualTo("—");
    }
}
