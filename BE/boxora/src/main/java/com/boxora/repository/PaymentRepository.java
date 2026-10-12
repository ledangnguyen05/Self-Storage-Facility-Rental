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

    boolean existsByTransactionId(String transactionId);

    java.util.List<Payment> findAllByBooking_Id(UUID bookingId);

    // Revenue grouped by facility - only PAID payments count as real revenue.
    // fromDate/toDate are inclusive bounds on payment_time; pass null to leave a side open.
    @Query("""
            SELECT new com.boxora.dto.response.FacilityRevenueResponse(
                f.id,
                f.name,
                SUM(p.amount),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.DEPOSIT THEN p.amount ELSE 0 END),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENTAL_FEE THEN p.amount ELSE 0 END),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENEWAL_FEE THEN p.amount ELSE 0 END),
                SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.EXTRA_CHARGE THEN p.amount ELSE 0 END),
                COUNT(p)
            )
            FROM Payment p
            JOIN p.booking b
            JOIN b.storageUnit su
            JOIN su.facility f
            WHERE p.status = com.boxora.enums.PaymentStatus.PAID
            AND (CAST(:fromDate AS timestamp) IS NULL OR p.paymentTime >= :fromDate)
            AND (CAST(:toDate AS timestamp) IS NULL OR p.paymentTime <= :toDate)
            GROUP BY f.id, f.name
            ORDER BY f.name
            """)
    List<FacilityRevenueResponse> sumRevenueByFacility(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate
    );

    // Same breakdown but collapsed to one system-wide row; COALESCE guards against
    // a null SUM when there are no matching payments in the period.
    @Query("""
            SELECT new com.boxora.dto.response.SystemRevenueSummaryResponse(
                COALESCE(SUM(p.amount), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.DEPOSIT THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENTAL_FEE THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.RENEWAL_FEE THEN p.amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN p.paymentType = com.boxora.enums.PaymentType.EXTRA_CHARGE THEN p.amount ELSE 0 END), 0),
                COUNT(p)
            )
            FROM Payment p
            WHERE p.status = com.boxora.enums.PaymentStatus.PAID
            AND (CAST(:fromDate AS timestamp) IS NULL OR p.paymentTime >= :fromDate)
            AND (CAST(:toDate AS timestamp) IS NULL OR p.paymentTime <= :toDate)
            """)
    SystemRevenueSummaryResponse sumSystemRevenue(
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate
    );
}