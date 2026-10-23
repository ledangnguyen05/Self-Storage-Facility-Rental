package com.boxora.repository;

import com.boxora.entity.HandoverRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface HandoverRecordRepository extends JpaRepository<HandoverRecord, UUID> {
    List<HandoverRecord> findByBooking_Id(UUID bookingId);

    boolean existsByBooking_IdAndRecordType(UUID bookingId, String recordType);

    default List<HandoverRecord> findByBookingId(UUID bookingId) {
        return findByBooking_Id(bookingId);
    }
}

