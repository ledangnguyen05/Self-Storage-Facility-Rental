package com.boxora.service;

import com.boxora.entity.Facility;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.FacilityStatus;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.UserRepository;
import com.boxora.mapper.FacilityMapper;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.impl.FacilityServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FacilityServiceTest {

    @Mock private FacilityRepository facilityRepository;
    @Mock private UserRepository userRepository;
    @Mock private FacilityMapper facilityMapper;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;

    @InjectMocks private FacilityServiceImpl facilityService;

    @Test
    void deleteDeactivatesFacilityAndPreservesFacilityHistory() {
        UUID facilityId = UUID.randomUUID();
        Facility facility = Facility.builder()
                .name("Boxora District 7")
                .code("HCM-D7")
                .status(FacilityStatus.ACTIVE)
                .build();
        facility.setId(facilityId);
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));

        facilityService.delete(facilityId);

        assertThat(facility.getStatus()).isEqualTo(FacilityStatus.INACTIVE);
        verify(facilityRepository).save(facility);
        verify(facilityRepository, never()).deleteById(facilityId);
        verify(facilityAccessGuard).checkFacilityAccess(facilityId);
        verify(activityLogService).record(
                eq(facilityId), eq(ActivityAction.FACILITY_DEACTIVATE), eq("FACILITY"), eq(facilityId),
                eq("Deactivated facility: Boxora District 7"), eq(null), eq(FacilityStatus.INACTIVE));
    }
}
