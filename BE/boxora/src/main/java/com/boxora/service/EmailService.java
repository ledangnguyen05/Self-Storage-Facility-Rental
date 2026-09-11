package com.boxora.service;

public interface EmailService {
    void sendPasswordResetEmail(String toEmail, String fullName, String resetToken);
    void sendWelcomeEmail(String toEmail, String fullName);
}