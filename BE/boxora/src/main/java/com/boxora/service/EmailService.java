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

    default void sendDetailedOverdueNoticeEmail(
            String toEmail,
            String fullName,
            String contractCode,
            String unitCode,
            String facilityName,
            long daysOverdue,
            java.math.BigDecimal principalDebt,
            java.math.BigDecimal dailyLateFee,
            java.math.BigDecimal lateFee,
            java.math.BigDecimal totalDebt,
            java.math.BigDecimal depositHeld,
            java.time.LocalDate dueDate,
            String feeFormulaExplanation,
            String overdueStage,
            String templateType,
            String notes
    ) {
        sendDetailedOverdueNoticeEmail(
                toEmail, fullName, contractCode, unitCode, null, facilityName,
                daysOverdue, principalDebt, dailyLateFee, lateFee, totalDebt, depositHeld,
                dueDate, feeFormulaExplanation, overdueStage, templateType, notes,
                null, null, null, null
        );
    }

    void sendDetailedOverdueNoticeEmail(
            String toEmail,
            String fullName,
            String contractCode,
            String unitCode,
            String unitTypeName,
            String facilityName,
            long daysOverdue,
            java.math.BigDecimal principalDebt,
            java.math.BigDecimal dailyLateFee,
            java.math.BigDecimal lateFee,
            java.math.BigDecimal totalDebt,
            java.math.BigDecimal depositHeld,
            java.time.LocalDate dueDate,
            String feeFormulaExplanation,
            String overdueStage,
            String templateType,
            String notes,
            java.math.BigDecimal totalLiquidationValue,
            Long estimatedHoldingDays,
            Integer inventoryItemCount,
            java.math.BigDecimal dailyRentalPrice
    );

    void sendSealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String sealTagNumber, long overdueDays, java.math.BigDecimal totalDebt, String reason);

    void sendUnsealingNoticeEmail(String toEmail, String fullName, String contractCode, String unitCode, String protocolNumber, String unsealedByName, String unsealReason);

    void sendRefundStatusEmail(String toEmail, String fullName, String requestCode, String status, java.math.BigDecimal amount, String bankName, String bankAccount, String transactionReference, String notes);

    void sendRenewalReminderEmail(String toEmail, String fullName, String contractCode, String unitCode, java.time.LocalDate endDate, long daysRemaining, java.math.BigDecimal monthlyFee);

    void sendHandoverPinEmail(String toEmail, String fullName, String unitCode, String bookingCode, String accessPin, String facilityName);

    void sendHandoverWithContractEmail(String toEmail, String fullName, String unitCode, String bookingCode, String accessPin, String facilityName, String contractCode, String startDate, String endDate, String rentalFee, String contractUrl);

    void sendBookingCancellationEmail(String toEmail, String fullName, String bookingCode, String facilityName, String unitCode, String reason, boolean isRejectedByStaff, java.math.BigDecimal refundAmount);
    void sendBookingCancellationRefundSuccessEmail(
            String toEmail,
            String fullName,
            String bookingCode,
            String requestCode,
            String facilityName,
            java.math.BigDecimal refundAmount,
            String bankName,
            String bankAccount,
            String bankAccountName,
            String transactionReference,
            String transferProofUrl,
            String processNotes
    );
    void sendCheckinOverdueReminderEmail(String toEmail, String fullName, String bookingCode, String facilityName, String facilityAddress, String facilityPhone, String unitCode, java.time.LocalDateTime checkInDateTime);
    void sendSimpleEmail(String toEmail, String subject, String body);
}
