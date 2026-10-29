package com.boxora.repository;

import com.boxora.dto.response.FacilityRevenueResponse;
import com.boxora.dto.response.SystemRevenueSummaryResponse;
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

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.transactionId = :transactionId")
    java.util.Optional<Payment> findByTransactionIdForUpdate(@Param("transactionId") String transactionId);

    boolean existsByTransactionId(String transactionId);

    boolean existsByBooking_IdAndStatus(UUID bookingId, com.boxora.enums.PaymentStatus status);

    java.util.List<Payment> findAllByBooking_Id(UUID bookingId);

    boolean existsByReceiptVoucherCodeIgnoreCase(String receiptVoucherCode);

    boolean existsByReferenceCodeIgnoreCase(String referenceCode);

    // Revenue grouped by facility - only PAID payments count as real revenue.
    // fromDate/toDate are inclusive bounds on payment_time; pass null to leave a side open.
    @Query("""
            SELECT new com.boxora.dto.response.FacilityRevenueResponse(
                f.id,
                f.name,
                SUM(CASE WHEN p.paymentType != com.boxora.enums.PaymentType.DEPOSIT THEN p.amount ELSE 0 END),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.DEPOSIT THEN p.amount ELSE 0 END),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENTAL_FEE THEN p.amount ELSE 0 END),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENEWAL_FEE THEN p.amount ELSE 0 END),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.EXTRA_CHARGE THEN p.amount ELSE 0 END),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.BOOKING_PAYMENT THEN p.amount ELSE 0 END),
                COUNT(p)
            )
            FROM Payment p
            LEFT JOIN p.booking b
            LEFT JOIN b.storageUnit bSu
            LEFT JOIN p.contract c
            JOIN Facility f ON (f.id = bSu.facility.id OR (bSu.facility.id IS NULL AND f.id = c.facility.id))
            WHERE p.status = com.boxora.enums.PaymentStatus.PAID
            AND (CAST(:fromDate AS timestamp) IS NULL OR p.paymentTime >= :fromDate)
            AND (CAST(:toDate AS timestamp) IS NULL OR p.paymentTime <= :toDate)
            AND (:facilityId IS NULL OR f.id = :facilityId)
            GROUP BY f.id, f.name
            ORDER BY f.name
            """)
    List<FacilityRevenueResponse> sumRevenueByFacility(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("facilityId") UUID facilityId
    );

    // Same breakdown but collapsed to one system-wide or facility-specific row; COALESCE guards against
    // a null SUM when there are no matching payments in the period.
    @Query("""
            SELECT new com.boxora.dto.response.SystemRevenueSummaryResponse(
                COALESCE(SUM(CASE WHEN p.paymentType != com.boxora.enums.PaymentType.DEPOSIT THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.DEPOSIT THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENTAL_FEE THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENEWAL_FEE THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.EXTRA_CHARGE THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.BOOKING_PAYMENT THEN p.amount ELSE 0 END), 0),
                COUNT(p)
            )
            FROM Payment p
            LEFT JOIN p.booking b
            LEFT JOIN b.storageUnit bSu
            LEFT JOIN p.contract c
            LEFT JOIN Facility f ON (f.id = bSu.facility.id OR (bSu.facility.id IS NULL AND f.id = c.facility.id))
            WHERE p.status = com.boxora.enums.PaymentStatus.PAID
            AND (CAST(:fromDate AS timestamp) IS NULL OR p.paymentTime >= :fromDate)
            AND (CAST(:toDate AS timestamp) IS NULL OR p.paymentTime <= :toDate)
            AND (:facilityId IS NULL OR f.id = :facilityId)
            """)
    SystemRevenueSummaryResponse sumSystemRevenue(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("facilityId") UUID facilityId
    );

    // Revenue chart series use the same PAID status, payment_time bounds, and facility resolution
    // as the report totals above. YEAR/MONTH keep the grouping in the database and avoid page caps.
    @Query("""
            SELECT YEAR(p.paymentTime), MONTH(p.paymentTime),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENTAL_FEE THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.DEPOSIT THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENEWAL_FEE THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.EXTRA_CHARGE THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.BOOKING_PAYMENT THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(p.amount), 0), COUNT(p)
            FROM Payment p
            LEFT JOIN p.booking b
            LEFT JOIN b.storageUnit bSu
            LEFT JOIN p.contract c
            LEFT JOIN Facility f ON (f.id = bSu.facility.id OR (bSu.facility.id IS NULL AND f.id = c.facility.id))
            WHERE p.status = com.boxora.enums.PaymentStatus.PAID
            AND (CAST(:fromDate AS timestamp) IS NULL OR p.paymentTime >= :fromDate)
            AND (CAST(:toDate AS timestamp) IS NULL OR p.paymentTime <= :toDate)
            AND (:facilityId IS NULL OR f.id = :facilityId)
            GROUP BY YEAR(p.paymentTime), MONTH(p.paymentTime)
            ORDER BY YEAR(p.paymentTime), MONTH(p.paymentTime)
            """)
    List<Object[]> sumRevenueByMonth(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("facilityId") UUID facilityId
    );

    // Keep unrecognized and null channels as their own groups so the dashboard can show them
    // as unknown instead of silently assigning them to a known payment method.
    @Query("""
            SELECT p.paymentMethod, COUNT(p),
                COALESCE(SUM(p.amount), 0),
                COALESCE(SUM(CASE WHEN p.confirmedAt IS NOT NULL OR UPPER(p.paymentMethod) = 'VNPAY' THEN p.amount ELSE 0 END), 0)
            FROM Payment p
            LEFT JOIN p.booking b
            LEFT JOIN b.storageUnit bSu
            LEFT JOIN p.contract c
            LEFT JOIN Facility f ON (f.id = bSu.facility.id OR (bSu.facility.id IS NULL AND f.id = c.facility.id))
            WHERE p.status = com.boxora.enums.PaymentStatus.PAID
            AND (CAST(:fromDate AS timestamp) IS NULL OR p.paymentTime >= :fromDate)
            AND (CAST(:toDate AS timestamp) IS NULL OR p.paymentTime <= :toDate)
            AND (:facilityId IS NULL OR f.id = :facilityId)
            GROUP BY p.paymentMethod
            """)
    List<Object[]> countPaidPaymentsByMethod(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            @Param("facilityId") UUID facilityId
    );
}
