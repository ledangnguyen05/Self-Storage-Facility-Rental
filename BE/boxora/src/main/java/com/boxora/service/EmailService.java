package com.boxora.service;

public interface EmailService {

    /** True when an SMTP host is set and (if the server needs authentication) credentials exist. */
    boolean isMailConfigured();

    /**
     * Sends an HTML mail synchronously, so callers can report the real outcome.
     *
     * @throws com.boxora.exception.AppException EMAIL_SEND_FAILED when mail is not configured or sending fails
     */
    void sendNow(String to, String subject, String htmlContent);

    void sendPasswordResetEmail(String toEmail, String fullName, String resetToken);

    /**
     * Same mail, delivered by the background mailer: the caller returns immediately and a delivery failure is
     * logged instead of thrown. Used by forgot-password, whose response time must not depend on whether the
     * address is registered.
     */
    void sendPasswordResetEmailAsync(String toEmail, String fullName, String resetToken);
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