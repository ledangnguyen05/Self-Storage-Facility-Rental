package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SealingUnsealRequest {

    @NotBlank(message = "Lý do gỡ niêm phong là bắt buộc")
    @Size(max = 500, message = "Lý do gỡ niêm phong tối đa 500 ký tự")
    private String reason;

    @Size(max = 1000, message = "Ghi chú tối đa 1000 ký tự")
    private String notes;

    /**
     * Only used when the contract is still past its end date after unsealing: access stays open until this day
     * (today to +30 days, default 3 days) before the nightly job may lock it again.
     */
    private LocalDate holdUntil;
}
