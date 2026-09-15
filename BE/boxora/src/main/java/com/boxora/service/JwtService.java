package com.boxora.service;

import com.boxora.entity.User;

public interface JwtService {
    String generateAccessToken(User user);
    String generateRefreshToken(User user);
    String generateResetPasswordToken(User user);
    String extractEmail(String token);
    boolean isTokenValid(String token);
    boolean isTokenExpired(String token);
    boolean isAccessToken(String token);
}
