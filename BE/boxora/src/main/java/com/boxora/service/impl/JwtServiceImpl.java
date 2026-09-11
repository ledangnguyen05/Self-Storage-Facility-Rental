package com.boxora.service.impl;

import com.boxora.entity.User;
import com.boxora.enums.TokenType;
import com.boxora.service.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Service
@Slf4j
public class JwtServiceImpl implements JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    private static final long RESET_PASSWORD_EXPIRATION = 15 * 60 * 1000L;

    @Override
    public String generateAccessToken(User user) {
        return buildToken(
                user.getEmail(),
                TokenType.ACCESS,
                accessTokenExpiration
        );
    }

    @Override
    public String generateRefreshToken(User user) {
        return buildToken(
                user.getEmail(),
                TokenType.REFRESH,
                refreshTokenExpiration
        );
    }

    @Override
    public String generateResetPasswordToken(User user) {
        return buildToken(
                user.getEmail(),
                TokenType.RESET_PASSWORD,
                RESET_PASSWORD_EXPIRATION
        );
    }

    @Override
    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    @Override
    public boolean isTokenValid(String token) {
        try {
            extractAllClaims(token);
            return !isTokenExpired(token);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public boolean isTokenExpired(String token) {
        return extractAllClaims(token)
                .getExpiration()
                .before(new Date());
    }

    private String buildToken(
            String email,
            TokenType tokenType,
            long expiration
    ) {
        return Jwts.builder()
                .subject(email)
                .claim("type", tokenType.name())
                .issuedAt(new Date())
                .expiration(
                        new Date(System.currentTimeMillis() + expiration)
                )
                .signWith(getSigningKey())
                .compact();
    }

    private Key getSigningKey() {
        return Keys.hmacShaKeyFor(
                secretKey.getBytes(StandardCharsets.UTF_8)
        );
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}