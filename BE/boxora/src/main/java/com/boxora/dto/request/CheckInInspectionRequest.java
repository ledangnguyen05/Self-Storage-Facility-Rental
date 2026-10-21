package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckInInspectionRequest {

    @NotNull(message = "Thiếu mã đơn đặt kho")
    private UUID bookingId;

    private Boolean doorConditionPassed;

    private Boolean cleanlinessPassed;

    private Boolean smartLockPassed;

    private Boolean sensorPassed;

    private Boolean wallStructurePassed;

    private List<String> evidencePhotos;

    private String unitCondition;

    private String notes;
}
