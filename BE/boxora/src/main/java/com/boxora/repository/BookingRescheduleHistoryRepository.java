package com.boxora.repository;

import com.boxora.entity.BookingRescheduleHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BookingRescheduleHistoryRepository extends JpaRepository<BookingRescheduleHistory, UUID> {
    List<BookingRescheduleHistory> findByBooking_IdOrderByCreatedAtDesc(UUID bookingId);
}
