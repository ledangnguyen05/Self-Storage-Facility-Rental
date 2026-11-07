package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketTransferUnitRequest {
    @NotNull(message = "Mã ô kho đích không được để trống")
    private UUID targetUnitId;
    private String reason;
    private Boolean customerAgreedDifferentType;
}
