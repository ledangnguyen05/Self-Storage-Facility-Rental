package com.boxora.entity;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Builder
@Entity
@Table(name = "permissions")
public class Permission extends BaseEntity{
    @Column(unique = true, nullable = false)
    @NotEmpty(message = "Permission name is required")
    private String name;

    @Column(name = "permission_group", unique = true, nullable = false)
    @NotEmpty(message = "Permission group is required")
    private String permissionGroup;

    private String description;

    @Column(nullable = false)
    private Boolean isActive=true;
}
