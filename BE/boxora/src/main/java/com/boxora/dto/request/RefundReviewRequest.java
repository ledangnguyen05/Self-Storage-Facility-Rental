package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefundReviewRequest {

    @NotBlank(message = "action is required")
    @Pattern(regexp = "APPROVE|REJECT", message = "action phải là APPROVE hoặc REJECT")
    private String action;

    private String reviewNote;

    private String rejectionReason;
}
