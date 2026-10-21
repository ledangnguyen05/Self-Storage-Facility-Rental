package com.boxora.dto.response;

import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {

    private UUID id;
    private String username;
    private String email;
    private String fullName;
    /** Null for accounts created with Google sign-in until the user completes the profile. */
    private String phone;
    /** Profile picture URL (set by Google sign-in), or null. */
    private String avatar;
    private Boolean isActive;
    private UUID roleId;
    private String roleName;
    private UUID facilityId;
    private String facilityName;
    private String facilityCode;
    private UUID assignedBy;
    private LocalDateTime assignedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
