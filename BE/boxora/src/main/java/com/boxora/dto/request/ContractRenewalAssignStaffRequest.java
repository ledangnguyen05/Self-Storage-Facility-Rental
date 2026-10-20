package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRenewalAssignStaffRequest {

    @NotNull(message = "ID nhân viên không được để trống")
    private UUID staffId;

    private String notes;

    private Boolean autoCreateShift;
}
