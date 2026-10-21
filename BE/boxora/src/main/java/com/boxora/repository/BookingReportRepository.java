package com.boxora.repository;

import com.boxora.entity.Booking;
import com.boxora.enums.BookingStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Booking queries for the overdue-debt report. */
public interface BookingReportRepository extends Repository<Booking, UUID> {

    /**
     * Bookings in one of {@code statuses} that ran past their end date and have no contract at all,
     * so the contract-based ledger cannot see them.
     */
    @EntityGraph(attributePaths = {"customer", "storageUnit", "storageUnit.facility"})
    @Query("""
            SELECT b FROM Booking b
            WHERE b.status IN :statuses
            AND b.endDate < :today
            AND (:facilityId IS NULL OR b.storageUnit.facility.id = :facilityId)
            AND NOT EXISTS (SELECT 1 FROM RentalContract c WHERE c.booking = b)
            ORDER BY b.endDate ASC
            """)
    List<Booking> findPastDueWithoutContract(
            @Param("statuses") Collection<BookingStatus> statuses,
            @Param("today") LocalDate today,
            @Param("facilityId") UUID facilityId
    );
}
