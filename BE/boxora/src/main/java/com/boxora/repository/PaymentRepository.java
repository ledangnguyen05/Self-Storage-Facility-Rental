package com.boxora.repository;

import com.boxora.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID>, JpaSpecificationExecutor<Payment> {

    java.util.Optional<Payment> findByTransactionId(String transactionId);

    boolean existsByTransactionId(String transactionId);

    boolean existsByBooking_IdAndStatus(UUID bookingId, com.boxora.enums.PaymentStatus status);

    java.util.List<Payment> findAllByBooking_Id(UUID bookingId);

    java.util.List<Payment> findAllByContract_Id(UUID contractId);

    /** Online payments still PENDING after their gateway link expired (cleaned up by PaymentServiceImpl). */
    java.util.List<Payment> findAllByStatusAndPaymentMethodAndPaymentTimeBefore(com.boxora.enums.PaymentStatus status, String paymentMethod, LocalDateTime before);

    java.util.List<Payment> findAllByBooking_IdAndStatusAndPaymentType(UUID bookingId, com.boxora.enums.PaymentStatus status,
                                                                        com.boxora.enums.PaymentType paymentType);

    java.util.List<Payment> findAllByContract_IdAndStatusAndPaymentType(UUID contractId, com.boxora.enums.PaymentStatus status,
                                                                         com.boxora.enums.PaymentType paymentType);

    // Counter payments (handover domain): one bank reference / paper receipt may back only one payment.
    boolean existsByReferenceCodeIgnoreCase(String referenceCode);

    boolean existsByReceiptVoucherCodeIgnoreCase(String receiptVoucherCode);

    // Revenue, monthly trend and payment-channel aggregates for the reports live in PaymentReportRepository.
}