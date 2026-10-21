package com.boxora.repository;

import com.boxora.entity.RefreshToken;
import com.boxora.entity.User;
import com.boxora.enums.RefreshTokenRevokeReason;
import com.boxora.enums.TokenType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenAndType(String token, TokenType type);

    Optional<RefreshToken> findByTokenAndTypeAndRevokedFalse(String token, TokenType type);

    /** Revokes the user's live tokens of one type (a new reset link replaces the older ones). */
    @Modifying
    @Query("""
            UPDATE RefreshToken rt SET rt.revoked = true, rt.revokedReason = :reason
            WHERE rt.user = :user AND rt.type = :type AND rt.revoked = false
            """)
    void revokeActiveTokensByType(@Param("user") User user, @Param("type") TokenType type,
                                  @Param("reason") RefreshTokenRevokeReason reason);

    /**
     * Revokes every live token of the user (password change, lock, theft suspicion). Tokens that were revoked
     * earlier keep their original reason, so a rotated token is still recognised as rotated afterwards.
     */
    @Modifying
    @Query("""
            UPDATE RefreshToken rt SET rt.revoked = true, rt.revokedReason = :reason
            WHERE rt.user = :user AND rt.revoked = false
            """)
    void revokeAllActiveTokens(@Param("user") User user, @Param("reason") RefreshTokenRevokeReason reason);

    /** The user's sessions that can still be refreshed, oldest first (used to cap the number of devices). */
    List<RefreshToken> findByUserAndTypeAndRevokedFalseAndExpiredAtAfterOrderByCreatedAtAsc(
            User user, TokenType type, LocalDateTime now);

    boolean existsByTokenAndRevokedFalse(String token);

    // True when the user already holds a live token of this type created at/after `since`
    // (used to tell a second tab racing a refresh from a replayed, stolen token).
    boolean existsByUserAndTypeAndRevokedFalseAndCreatedAtGreaterThanEqual(User user, TokenType type, LocalDateTime since);
}