package com.boxora.repository;

import com.boxora.entity.Payment;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Read-only aggregates behind the revenue / trend / payment-channel reports.
 *
 * <p>A payment belongs to the facility of its booking's unit, or of its contract when it has no booking.
 * Every query takes a half-open period {@code [fromDate, toDateExclusive)} on the payment time
 * (falls back to the creation time) and an optional facility filter.
 */
public interface PaymentReportRepository extends Repository<Payment, UUID> {

    /**
     * Row layout: {@code [facilityId, facilityName, paymentType, status, SUM(amount), COUNT, bookingDepositPart]}.
     * {@code bookingDepositPart} is the share of BOOKING_PAYMENT amounts that equals the booking deposit
     * (the rest is rent) and is 0 for every other payment type. Facility columns are null for payments
     * that cannot be traced to a facility.
     */
    @Query("""
            SELECT f.id, f.name, p.paymentType, p.status, SUM(p.amount), COUNT(p),
                   SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.BOOKING_PAYMENT
                            THEN (CASE WHEN b.depositAmount < p.amount THEN b.depositAmount ELSE p.amount END)
                            ELSE 0 END)
            FROM Payment p
            LEFT JOIN p.booking b
            LEFT JOIN b.storageUnit bSu
            LEFT JOIN p.contract c
            LEFT JOIN Facility f ON (f.id = bSu.facility.id OR (bSu.facility.id IS NULL AND f.id = c.facility.id))
            WHERE p.status IN (com.boxora.enums.PaymentStatus.PAID,
                               com.boxora.enums.PaymentStatus.REFUNDED,
                               com.boxora.enums.PaymentStatus.REFUND_PENDING)
            AND COALESCE(p.paymentTime, p.createdAt) >= :fromDate
            AND COALESCE(p.paymentTime, p.createdAt) < :toDateExclusive
            AND (:facilityId IS NULL OR f.id = :facilityId)
            GROUP BY f.id, f.name, p.paymentType, p.status
            """)
    List<Object[]> aggregateByFacilityTypeAndStatus(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDateExclusive") LocalDateTime toDateExclusive,
            @Param("facilityId") UUID facilityId
    );

    /** Row layout: {@code [year, month, paymentType, status, SUM(amount), COUNT]} for PAID and REFUNDED payments. */
    @Query("""
            SELECT EXTRACT(YEAR FROM COALESCE(p.paymentTime, p.createdAt)),
                   EXTRACT(MONTH FROM COALESCE(p.paymentTime, p.createdAt)),
                   p.paymentType, p.status, SUM(p.amount), COUNT(p)
            FROM Payment p
            LEFT JOIN p.booking b
            LEFT JOIN b.storageUnit bSu
            LEFT JOIN p.contract c
            LEFT JOIN Facility f ON (f.id = bSu.facility.id OR (bSu.facility.id IS NULL AND f.id = c.facility.id))
            WHERE p.status IN (com.boxora.enums.PaymentStatus.PAID, com.boxora.enums.PaymentStatus.REFUNDED)
            AND COALESCE(p.paymentTime, p.createdAt) >= :fromDate
            AND COALESCE(p.paymentTime, p.createdAt) < :toDateExclusive
            AND (:facilityId IS NULL OR f.id = :facilityId)
            GROUP BY EXTRACT(YEAR FROM COALESCE(p.paymentTime, p.createdAt)),
                     EXTRACT(MONTH FROM COALESCE(p.paymentTime, p.createdAt)),
                     p.paymentType, p.status
            """)
    List<Object[]> aggregateByMonth(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDateExclusive") LocalDateTime toDateExclusive,
            @Param("facilityId") UUID facilityId
    );

    /** Row layout: {@code [paymentMethod, COUNT, SUM(amount)]} for PAID payments. */
    @Query("""
            SELECT p.paymentMethod, COUNT(p), SUM(p.amount)
            FROM Payment p
            LEFT JOIN p.booking b
            LEFT JOIN b.storageUnit bSu
            LEFT JOIN p.contract c
            LEFT JOIN Facility f ON (f.id = bSu.facility.id OR (bSu.facility.id IS NULL AND f.id = c.facility.id))
            WHERE p.status = com.boxora.enums.PaymentStatus.PAID
            AND COALESCE(p.paymentTime, p.createdAt) >= :fromDate
            AND COALESCE(p.paymentTime, p.createdAt) < :toDateExclusive
            AND (:facilityId IS NULL OR f.id = :facilityId)
            GROUP BY p.paymentMethod
            """)
    List<Object[]> aggregateByMethod(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDateExclusive") LocalDateTime toDateExclusive,
            @Param("facilityId") UUID facilityId
    );

    /**
     * Money customers already paid on a contract for the overstay (late fee or rent collected at the cashier).
     * Row layout: {@code [contractId, paymentTime, amount]}; the caller keeps the rows paid on or after the due date.
     */
    @Query("""
            SELECT p.contract.id, COALESCE(p.paymentTime, p.createdAt), p.amount
            FROM Payment p
            WHERE p.contract.id IN :contractIds
            AND p.status = com.boxora.enums.PaymentStatus.PAID
            AND p.paymentType IN (com.boxora.enums.PaymentType.EXTRA_CHARGE, com.boxora.enums.PaymentType.RENTAL_FEE)
            """)
    List<Object[]> findOverstayPayments(@Param("contractIds") Collection<UUID> contractIds);
}
