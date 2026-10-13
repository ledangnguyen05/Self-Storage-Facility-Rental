package com.boxora.dto.request;

import com.boxora.enums.FacilityStatus;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityCreateRequest {

    @NotBlank(message = "Facility name is required")
    @Size(min = 2, max = 150, message = "Facility name must be between 2 and 150 characters")
    private String name;

    @NotBlank(message = "Facility code is required")
    @Size(min = 2, max = 30, message = "Facility code must be between 2 and 30 characters")
    private String code;

    @NotBlank(message = "Address is required")
    @Size(max = 255, message = "Address must not exceed 255 characters")
    private String address;

    @Size(max = 50, message = "City must not exceed 50 characters")
    private String city;

    @Size(max = 20, message = "Contact phone must not exceed 20 characters")
    private String contactPhone;

    @Email(message = "Email must be valid")
    @Size(max = 150, message = "Email must not exceed 150 characters")
    private String email;

    private UUID managerId;

    private LocalTime openTime;
    private LocalTime closeTime;

    private String description;
}