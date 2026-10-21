package com.boxora.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractRenewalSwitchMethodRequest {

    @NotBlank(message = "Phương thức ký và thanh toán không được để trống")
    private String method; // "ONLINE" or "COUNTER"

    private LocalDate appointmentDate; // Bắt buộc khi method = COUNTER

    private String appointmentTime; // Giờ hẹn check-in tại quầy cơ sở (ví dụ: "09:00", "14:30")

    private String notes;
}
