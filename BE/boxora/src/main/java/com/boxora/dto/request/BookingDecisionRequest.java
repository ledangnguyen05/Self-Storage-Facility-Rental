package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class BookingDecisionRequest {
    @NotNull
    private Boolean approved;

    private java.util.UUID assignedStaffId;

    @Size(max = 500, message = "Ghi chú phân công tối đa 500 ký tự")
    private String notes;
}
