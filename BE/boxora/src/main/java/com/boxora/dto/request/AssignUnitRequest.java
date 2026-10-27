package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssignUnitRequest {
    @NotNull(message = "Mã ô kho vật lý không được để trống")
    private UUID unitId;

    private String notes;
}
