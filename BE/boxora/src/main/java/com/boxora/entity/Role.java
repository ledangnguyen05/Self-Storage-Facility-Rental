package com.boxora.entity;

import lombok.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "roles")
public class Role extends BaseEntity {

    @Indexed(unique = true)
    private String name;

    private String description;

    @Builder.Default
    private Boolean isActive = true;
}