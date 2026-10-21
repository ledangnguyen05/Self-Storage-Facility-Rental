package com.boxora.repository;

import com.boxora.entity.OverdueCase;
import com.boxora.entity.RentalContract;
import com.boxora.enums.OverdueCaseStatus;
import com.boxora.enums.RentalContractStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Overdue episodes plus the read queries of the overdue domain (contracts and payments are read here so the
 * contract/payment repositories owned by other modules stay untouched).
 */
@Repository
public interface OverdueCaseRepository extends JpaRepository<OverdueCase, UUID> {

    Optional<OverdueCase> findFirstByContract_IdAndStatus(UUID contractId, OverdueCaseStatus status);

    @Query("SELECT oc FROM OverdueCase oc WHERE oc.status = :status AND oc.contract.id IN :contractIds")
    List<OverdueCase> findByStatusAndContractIds(@Param("status") OverdueCaseStatus status,
                                                 @Param("contractIds") Collection<UUID> contractIds);

    @Query("""
            SELECT oc FROM OverdueCase oc JOIN FETCH oc.contract c
            WHERE oc.status = :status AND (:facilityId IS NULL OR oc.facility.id = :facilityId)
            """)
    List<OverdueCase> findAllByStatusWithContract(@Param("status") OverdueCaseStatus status,
                                                  @Param("facilityId") UUID facilityId);

    /**
     * Every contract the overdue rule applies to on {@code asOf}: ACTIVE past its end date, every contract already
     * marked OVERDUE / OVERDUE_LOCKED (by the nightly job, a manual lockout or a sealing), whatever its date, and
     * EXPIRED contracts whose tenant still holds the unit (booking ACTIVE / OVERDUE, i.e. never returned).
     */
    @Query("""
            SELECT c FROM RentalContract c
            JOIN FETCH c.customer
            JOIN FETCH c.unit
            JOIN FETCH c.facility
            LEFT JOIN FETCH c.booking b
            WHERE ((c.status = com.boxora.enums.RentalContractStatus.ACTIVE AND c.endDate < :asOf)
                   OR c.status IN (com.boxora.enums.RentalContractStatus.OVERDUE,
                                   com.boxora.enums.RentalContractStatus.OVERDUE_LOCKED)
                   OR (c.status = com.boxora.enums.RentalContractStatus.EXPIRED AND c.endDate < :asOf
                       AND b.status IN (com.boxora.enums.BookingStatus.ACTIVE, com.boxora.enums.BookingStatus.OVERDUE)))
              AND (:facilityId IS NULL OR c.facility.id = :facilityId)
            ORDER BY c.endDate ASC
            """)
    List<RentalContract> findOverdueContracts(@Param("asOf") LocalDate asOf, @Param("facilityId") UUID facilityId);

    /** Ended contracts whose booking still holds a door PIN (stale credentials to revoke). */
    @Query("""
            SELECT c FROM RentalContract c
            JOIN FETCH c.booking b
            JOIN FETCH c.unit
            WHERE c.status IN :statuses AND b.accessPin IS NOT NULL
            """)
    List<RentalContract> findEndedContractsWithLiveCredentials(@Param("statuses") Collection<RentalContractStatus> statuses);

    /**
     * Rent and extra-charge payments received for a contract (or its booking) from {@code since}; deducted from the
     * overdue debt. Renewal fees are excluded because a completed renewal already moves the contract end date.
     */
    @Query("""
            SELECT SUM(p.amount) FROM Payment p
            LEFT JOIN p.contract pc
            LEFT JOIN p.booking pb
            WHERE p.status = com.boxora.enums.PaymentStatus.PAID
              AND p.paymentType IN (com.boxora.enums.PaymentType.RENTAL_FEE, com.boxora.enums.PaymentType.EXTRA_CHARGE)
              AND p.paymentTime >= :since
              AND (pc.id = :contractId OR pb.id = :bookingId)
            """)
    BigDecimal sumOverdueCredits(@Param("contractId") UUID contractId,
                                 @Param("bookingId") UUID bookingId,
                                 @Param("since") LocalDateTime since);

    default BigDecimal sumOverdueCredits(RentalContract contract) {
        if (contract == null || contract.getEndDate() == null) {
            return BigDecimal.ZERO;
        }
        UUID bookingId = contract.getBooking() != null ? contract.getBooking().getId() : null;
        BigDecimal sum = sumOverdueCredits(contract.getId(), bookingId, contract.getEndDate().plusDays(1).atStartOfDay());
        return sum != null ? sum : BigDecimal.ZERO;
    }
}
