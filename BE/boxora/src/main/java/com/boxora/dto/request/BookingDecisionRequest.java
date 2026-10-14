package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class BookingDecisionRequest {
    @NotNull
    private Boolean approved;
}
