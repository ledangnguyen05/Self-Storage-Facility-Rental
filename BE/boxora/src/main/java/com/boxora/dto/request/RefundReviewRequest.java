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

    private Boolean approved;

    private String reviewNote;

    private String rejectionReason;

    @com.fasterxml.jackson.annotation.JsonSetter("approved")
    public void setApproved(Boolean approved) {
        this.approved = approved;
        if (approved != null && (this.action == null || this.action.isBlank())) {
            this.action = approved ? "APPROVE" : "REJECT";
        }
    }

    @com.fasterxml.jackson.annotation.JsonSetter("action")
    public void setAction(String action) {
        if (action != null && !action.isBlank()) {
            this.action = action.trim().toUpperCase();
        } else {
            this.action = action;
        }
    }
}
