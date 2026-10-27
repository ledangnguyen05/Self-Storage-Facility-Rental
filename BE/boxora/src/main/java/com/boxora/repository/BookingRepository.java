package com.boxora.repository;

import com.boxora.entity.Booking;
import com.boxora.enums.BookingStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID>, JpaSpecificationExecutor<Booking> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") UUID id);

    Optional<Booking> findByBookingCode(String bookingCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.bookingCode = :bookingCode")
    Optional<Booking> findByBookingCodeForUpdate(@Param("bookingCode") String bookingCode);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility", "facility", "unitType"})
    @Query("SELECT b FROM Booking b WHERE (b.storageUnit IS NOT NULL AND b.storageUnit.facility.id = :facilityId) OR (b.storageUnit IS NULL AND b.facility.id = :facilityId)")
    List<Booking> findAllByFacilityIdIncludingNullUnit(@Param("facilityId") UUID facilityId);

    List<Booking> findByCustomer_Id(UUID customerId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility"})
    List<Booking> findByStorageUnit_Facility_Id(UUID facilityId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility"})
    List<Booking> findByCustomer_IdAndStorageUnit_Facility_Id(UUID customerId, UUID facilityId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility"})
    List<Booking> findByStatusOrderByCreatedAtAsc(BookingStatus status);

    boolean existsByStorageUnit_IdAndStatusInAndIdNot(UUID storageUnitId, Collection<BookingStatus> statuses, UUID excludedBookingId);

    List<Booking> findByStatusIn(Collection<BookingStatus> statuses);

    List<Booking> findByStatusAndPaymentExpiresAtBefore(BookingStatus status, Instant expiresAt);

    boolean existsByStorageUnit_Id(UUID storageUnitId);

    boolean existsByStorageUnit_IdAndStatusIn(UUID storageUnitId, Collection<BookingStatus> statuses);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility"})
    Optional<Booking> findFirstByStorageUnit_IdOrderByCreatedAtDesc(UUID storageUnitId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility"})
    Optional<Booking> findFirstByStorageUnit_IdAndStatusInOrderByCreatedAtDesc(UUID storageUnitId, Collection<BookingStatus> statuses);

    List<Booking> findByStatusAndCreatedAtBefore(BookingStatus status, LocalDateTime threshold);

    @Query("SELECT b FROM Booking b WHERE b.status = :status AND ("
            + "(b.paymentExpiresAt IS NOT NULL AND b.paymentExpiresAt < CURRENT_TIMESTAMP) OR "
            + "(b.paymentExpiresAt IS NULL AND b.createdAt < :threshold) OR b.startDate < :today)")
    List<Booking> findExpiredPendingBookings(
            @Param("status") BookingStatus status,
            @Param("threshold") LocalDateTime threshold,
            @Param("today") LocalDate today
    );

    @Query("SELECT b FROM Booking b WHERE b.status IN :statuses AND b.handoverTime IS NULL AND ("
            + "(b.holdExpiresAt IS NOT NULL AND b.holdExpiresAt < :now) OR "
            + "(b.paymentExpiresAt IS NOT NULL AND b.paymentExpiresAt < :now) OR "
            + "(b.holdExpiresAt IS NULL AND b.expectedCheckInAt IS NOT NULL AND b.expectedCheckInAt < :checkInThreshold))")
    List<Booking> findExpiredHoldCandidates(
            @Param("statuses") Collection<BookingStatus> statuses,
            @Param("now") Instant now,
            @Param("checkInThreshold") LocalDateTime checkInThreshold,
            @Param("todayThreshold") LocalDate todayThreshold
    );

    default List<Booking> findExpiredHoldCandidates(Collection<BookingStatus> statuses, Instant now) {
        LocalDateTime checkInThreshold = LocalDateTime.now();
        LocalDate todayThreshold = LocalDate.now();
        return findExpiredHoldCandidates(statuses, now, checkInThreshold, todayThreshold);
    }

    @Query("SELECT b FROM Booking b WHERE b.signingMethod = 'IN_PERSON' "
            + "AND b.status NOT IN ('ACTIVE', 'COMPLETED', 'CANCELLED') "
            + "AND b.handoverTime IS NULL "
            + "AND b.checkinOverdueReminderSentAt IS NULL "
            + "AND ("
            + "  (b.expectedCheckInAt IS NOT NULL AND b.expectedCheckInAt <= :threshold) "
            + "  OR (b.expectedCheckInAt IS NULL AND b.startDate <= :todayThreshold)"
            + ")")
    List<Booking> findOverdueInPersonCheckinReminders(
            @Param("threshold") LocalDateTime threshold,
            @Param("todayThreshold") LocalDate todayThreshold
    );
}
