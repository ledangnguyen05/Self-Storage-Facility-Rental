package com.boxora.service;

import com.boxora.entity.Facility;
import com.boxora.enums.ActivityAction;
import com.boxora.enums.FacilityStatus;
import com.boxora.repository.ActivityLogRepository;
import com.boxora.repository.FacilityPolicyRepository;
import com.boxora.repository.FacilityRepository;
import com.boxora.repository.StorageUnitRepository;
import com.boxora.repository.UserRepository;
import com.boxora.mapper.FacilityMapper;
import com.boxora.security.FacilityAccessGuard;
import com.boxora.service.impl.FacilityServiceImpl;
import com.boxora.validator.FloorPlanValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FacilityServiceTest {

    @Mock private FacilityRepository facilityRepository;
    @Mock private UserRepository userRepository;
    @Mock private FacilityMapper facilityMapper;
    @Mock private ActivityLogService activityLogService;
    @Mock private FacilityAccessGuard facilityAccessGuard;
    @Mock private FloorPlanValidator floorPlanValidator;
    @Mock private FacilityPolicyRepository facilityPolicyRepository;
    @Mock private StorageUnitRepository storageUnitRepository;
    @Mock private ActivityLogRepository activityLogRepository;

    @InjectMocks private FacilityServiceImpl facilityService;

    @Test
    void deleteFacilitySuccessfully() {
        UUID facilityId = UUID.randomUUID();
        Facility facility = Facility.builder()
                .name("Boxora District 7")
                .code("HCM-D7")
                .status(FacilityStatus.ACTIVE)
                .build();
        facility.setId(facilityId);
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(facilityPolicyRepository.findByFacility_Id(facilityId)).thenReturn(Optional.empty());
        when(storageUnitRepository.findByFacility_Id(facilityId)).thenReturn(Collections.emptyList());

        facilityService.delete(facilityId);

        verify(activityLogRepository).detachFacility(facilityId);
        verify(facilityRepository).delete(facility);
        verify(facilityRepository).flush();
        verify(facilityAccessGuard).checkFacilityAccess(facilityId);
        verify(activityLogService).record(
                eq(null), eq(ActivityAction.FACILITY_DEACTIVATE), eq("FACILITY"), eq(facilityId),
                eq("Deleted facility: Boxora District 7"), eq(null), eq(null));
    }
}
