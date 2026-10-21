package com.boxora.dto.request;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LockoutRequest {
    @Size(max = 500, message = "Lý do khóa truy cập tối đa 500 ký tự")
    private String reason;

    /**
     * Must be true to lock while a manager-granted access hold is still running; {@code reason} is then mandatory.
     */
    private Boolean overrideAccessHold;
}
