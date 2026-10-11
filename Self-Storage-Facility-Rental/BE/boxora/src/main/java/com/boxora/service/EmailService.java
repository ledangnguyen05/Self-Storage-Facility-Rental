package com.boxora.service;

public interface EmailService {
    void sendPasswordResetEmail(String toEmail, String fullName, String resetToken);
    void sendWelcomeEmail(String toEmail, String fullName);

    // Gửi cảnh báo khẩn cấp khi Master Key được sử dụng - cho Business Manager & Admin
    void sendMasterKeyAlertEmail(String toEmail, String recipientName, String facilityName,
                                 String performedByName, String witnessName,
                                 String category, String severity,
                                 String reason, String documentReference);
}