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

    @NotBlank(message = "Vui lòng chọn duyệt hoặc từ chối")
    @Pattern(regexp = "APPROVE|REJECT", message = "action phải là APPROVE hoặc REJECT")
    private String action;

    @jakarta.validation.constraints.Size(max = 500, message = "Ghi chú tối đa 500 ký tự")
    private String reviewNote;

    @jakarta.validation.constraints.Size(max = 500, message = "Lý do từ chối tối đa 500 ký tự")
    private String rejectionReason;
}
