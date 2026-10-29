package com.boxora.dto.request;

import jakarta.validation.constraints.*;
import lombok.*;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserCreateRequest {

    @Size(max = 30, message = "Username must be between 3 and 30 characters")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Email should be valid")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 5, message = "Password must be greater than 5 characters")
    private String password;

    @NotBlank(message = "Full name is required")
    @Size(max = 30, message = "Full name must be less than 30 characters")
    private String fullName;

    @NotBlank(message = "Phone is required")
    @Pattern(
        regexp = "^(0|\\+84)(3|5|7|8|9)[0-9]{8}$",
        message = "Phone must be a valid Vietnamese phone number"
    )
    private String phone;
    // Admin assigns role when creating a user
    // If null, service will default to "customer"
    private UUID roleId;
    private String roleName;

    // Assigned facility (applicable for STAFF / FACILITY_MANAGER)
    private UUID facilityId;
}
