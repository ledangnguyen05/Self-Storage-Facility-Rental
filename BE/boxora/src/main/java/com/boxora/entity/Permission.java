package com.boxora.entity;

import jakarta.validation.constraints.NotEmpty;
import lombok.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Builder
@Document(collection = "permissions")
public class Permission extends BaseEntity {

    @Indexed(unique = true)
    @NotEmpty(message = "Permission name is required")
    private String name;

    @NotEmpty(message = "Permission group is required")
    private String permissionGroup;

    private String description;

    @Builder.Default
    private Boolean isActive = true;
}

