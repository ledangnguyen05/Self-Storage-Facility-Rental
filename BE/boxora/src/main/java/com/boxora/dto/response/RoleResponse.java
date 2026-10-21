package com.boxora.dto.response;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@Builder
public class RoleResponse {
    private UUID id;
    private String name;
    private String description;
    /** Boxed so Jackson serialises the property as `isActive` (a primitive `isActive` would become `active`). */
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime  updatedAt;
}
