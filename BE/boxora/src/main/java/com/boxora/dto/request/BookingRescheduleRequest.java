package com.boxora.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingRescheduleRequest {

    @NotNull(message = "Ngày bắt đầu thuê mới không được để trống")
    private LocalDate newStartDate;

    /** Ngày/giờ nhận kho dự kiến mới */
    private LocalDateTime newExpectedCheckInAt;

    /** Giờ hẹn nhận kho mới (ví dụ: "14:00") */
    private String newCheckInTime;

    /** Lý do đổi lịch */
    private String reason;
}
