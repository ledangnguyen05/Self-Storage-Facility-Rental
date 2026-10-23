package com.boxora.repository;

import com.boxora.entity.RefreshToken;
import com.boxora.entity.User;
import com.boxora.enums.TokenType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenAndType(String token, TokenType type);

    Optional<RefreshToken> findByTokenAndTypeAndRevokedFalse(String token, TokenType type);

    // Revoke all tokens of a specific type for a user (used on logout)
    @Modifying
    @Query("UPDATE RefreshToken rt SET rt.revoked = true WHERE rt.user = :user AND rt.type = :type")
    void revokeAllUserTokensByType(@Param("user") User user, @Param("type") TokenType type);

    // Revoke all tokens for a user (used on password change)
    @Modifying
    @Query("UPDATE RefreshToken rt SET rt.revoked = true WHERE rt.user = :user")
    void revokeAllUserTokens(@Param("user") User user);

    boolean existsByTokenAndRevokedFalse(String token);
}