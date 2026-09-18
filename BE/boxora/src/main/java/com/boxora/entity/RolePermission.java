package com.boxora.entity;

import jakarta.validation.constraints.Size;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"role", "permission"})
@Builder
@Document(collection = "role_permissions")
public class RolePermission extends BaseEntity {

    @DBRef
    private Role role;

    @DBRef
    private Permission permission;

    @Builder.Default
    private Boolean isActive = true;

    @Size(max = 255, message = "Description must be less than 255 characters")
    private String description;
}

