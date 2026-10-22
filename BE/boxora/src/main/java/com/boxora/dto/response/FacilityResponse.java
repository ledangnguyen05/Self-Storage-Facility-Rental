package com.boxora.dto.response;

import com.boxora.enums.FacilityStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
public class FacilityResponse {
    private UUID id;
    private String name;
    private String code;
    private String address;
    private String city;
    private String contactPhone;
    private String email;

    private UUID managerId;
    private String managerName;

    private FacilityStatus status;
    private LocalTime openTime;
    private LocalTime closeTime;
    private String description;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String layoutConfig;
    private String imageUrl;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
