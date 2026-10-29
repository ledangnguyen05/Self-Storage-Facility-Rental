package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FacilityUpdateRequest {

    @Size(min = 2, max = 150, message = "Facility name must be between 2 and 150 characters")
    private String name;

    @Size(min = 2, max = 30, message = "Facility code must be between 2 and 30 characters")
    private String code;

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

    private String status; // FacilityStatus name — validated/parsed in the service

    private LocalTime openTime;
    private LocalTime closeTime;

    private String description;

    @Digits(integer = 3, fraction = 7, message = "Latitude must have at most 7 decimal places")
    @DecimalMin(value = "-90.0", message = "Latitude must be at least -90")
    @DecimalMax(value = "90.0", message = "Latitude must be at most 90")
    private BigDecimal latitude;

    @Digits(integer = 3, fraction = 7, message = "Longitude must have at most 7 decimal places")
    @DecimalMin(value = "-180.0", message = "Longitude must be at least -180")
    @DecimalMax(value = "180.0", message = "Longitude must be at most 180")
    private BigDecimal longitude;

    private String layoutConfig;
    private String imageUrl;
    private Boolean clearImageUrl;

    /** Explicitly clears both coordinates when the admin removes the GPS location. */
    private Boolean clearCoordinates;
}
