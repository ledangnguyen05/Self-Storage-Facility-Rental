package com.boxora.service;

public interface EmailService {
    void sendPasswordResetEmail(String toEmail, String fullName, String resetToken);
    void sendWelcomeEmail(String toEmail, String fullName);
    void sendContractSigningOtp(String toEmail, String otp);

    // Gửi cảnh báo khẩn cấp khi Master Key được sử dụng - cho Business Manager & Admin
    void sendMasterKeyAlertEmail(String toEmail, String recipientName, String facilityName,
                                 String performedByName, String witnessName,
                                 String category, String severity,
                                 String reason, String documentReference);

    void sendContractSignedConfirmationEmail(String toEmail, String fullName, String contractCode, String unitCode, String accessPin, String contractUrl);

    void sendPaymentSuccessEmail(String toEmail, String fullName, String txnRef, java.math.BigDecimal amount, String description);

    void sendOverdueNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, long daysOverdue, java.math.BigDecimal totalDebt, String overdueStage);

    void sendSealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String sealTagNumber, long overdueDays, java.math.BigDecimal totalDebt, String reason);

    void sendUnsealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String unsealedByName, String unsealReason);

    void sendRefundStatusEmail(String toEmail, String fullName, String requestCode, String status, java.math.BigDecimal amount, String bankName, String bankAccount, String transactionReference, String notes);

    void sendRenewalReminderEmail(String toEmail, String fullName, String contractCode, String unitCode, java.time.LocalDate endDate, long daysRemaining, java.math.BigDecimal monthlyFee);

    void sendHandoverPinEmail(String toEmail, String fullName, String unitCode, String bookingCode, String accessPin, String facilityName);
}