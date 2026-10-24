package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserUpdateRequest {

    @Size(min = 3, max = 30, message = "Username must be between 3 and 30 characters")
    private String username;

    @Size(min=3, max = 30, message = "Full name must be between 3 and 30 characters")
    private String fullName;

    private Boolean isActive;

    @Pattern(
        regexp = "^(0|\\+84)(3|5|7|8|9)[0-9]{8}$",
        message = "Phone must be a valid Vietnamese phone number"
    )
    private String phone;
    
    // Only admin can change role
    private UUID roleId;

    // Assigned facility (applicable for STAFF / FACILITY_MANAGER)
    private UUID facilityId;
}