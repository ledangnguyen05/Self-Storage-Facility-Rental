package com.boxora.entity;

import com.boxora.enums.TokenType;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
@Builder
@Document(collection = "refresh_tokens")
public class RefreshToken extends BaseEntity {

    @DBRef
    private User user;

    @Indexed(unique = true)
    @NotEmpty(message = "Token is required")
    private String token;

    private TokenType type;

    private LocalDateTime expiredAt;

    private LocalDateTime lastUsedAt;

    @Builder.Default
    private Boolean revoked = false;
}

