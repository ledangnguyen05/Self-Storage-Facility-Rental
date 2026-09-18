package com.boxora.repository;

import com.boxora.entity.User;
import com.boxora.enums.TokenType;

public interface RefreshTokenRepositoryCustom {

    void revokeAllUserTokensByType(User user, TokenType type);

    void revokeAllUserTokens(User user);
}
