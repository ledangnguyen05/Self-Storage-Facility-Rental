package com.boxora.repository;

import com.boxora.entity.RefreshToken;
import com.boxora.enums.TokenType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends MongoRepository<RefreshToken, UUID>, RefreshTokenRepositoryCustom {

    Optional<RefreshToken> findByTokenAndType(String token, TokenType type);

    Optional<RefreshToken> findByTokenAndTypeAndRevokedFalse(String token, TokenType type);

    boolean existsByTokenAndRevokedFalse(String token);
}