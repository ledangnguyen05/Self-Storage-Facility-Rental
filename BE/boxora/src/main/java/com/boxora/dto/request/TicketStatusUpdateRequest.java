package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatusUpdateRequest {
    @NotBlank(message = "Status is required")
    private String status;

    private String note;
    private String priority;
    private List<String> evidenceUrls;
}
