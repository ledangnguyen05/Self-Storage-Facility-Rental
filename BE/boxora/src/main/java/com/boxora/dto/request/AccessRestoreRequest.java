package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/** Manager action "Mở khóa truy cập" on an overdue contract. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccessRestoreRequest {

    @NotBlank(message = "Vui lòng nhập lý do mở khóa truy cập")
    @Size(max = 500, message = "Lý do mở khóa tối đa 500 ký tự")
    private String reason;

    /**
     * Only used while the contract is still past its end date: access stays open and the nightly job does not
     * lock it again before this date (today to +30 days). Defaults to 3 days.
     */
    private LocalDate holdUntil;
}
