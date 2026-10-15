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

    List<Booking> findByCustomer_Id(UUID customerId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility"})
    List<Booking> findByStatusOrderByCreatedAtAsc(BookingStatus status);

    boolean existsByStorageUnit_IdAndStatusInAndIdNot(UUID storageUnitId, Collection<BookingStatus> statuses, UUID excludedBookingId);

    List<Booking> findByStatusIn(Collection<BookingStatus> statuses);

    List<Booking> findByStatusAndPaymentExpiresAtBefore(BookingStatus status, Instant expiresAt);

    boolean existsByStorageUnit_Id(UUID storageUnitId);

    boolean existsByStorageUnit_IdAndStatusIn(UUID storageUnitId, Collection<BookingStatus> statuses);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility"})
    Optional<Booking> findFirstByStorageUnit_IdOrderByCreatedAtDesc(UUID storageUnitId);

    List<Booking> findByStatusAndCreatedAtBefore(BookingStatus status, LocalDateTime threshold);

    @Query("SELECT b FROM Booking b WHERE b.status = :status AND ("
            + "(b.paymentExpiresAt IS NOT NULL AND b.paymentExpiresAt < CURRENT_TIMESTAMP) OR "
            + "(b.paymentExpiresAt IS NULL AND b.createdAt < :threshold) OR b.startDate < :today)")
    List<Booking> findExpiredPendingBookings(
            @Param("status") BookingStatus status,
            @Param("threshold") LocalDateTime threshold,
            @Param("today") LocalDate today
    );
}
