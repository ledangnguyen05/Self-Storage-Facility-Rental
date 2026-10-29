package com.boxora.repository;

import com.boxora.entity.HandoverRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface HandoverRecordRepository extends JpaRepository<HandoverRecord, UUID> {
    List<HandoverRecord> findByBooking_Id(UUID bookingId);

    List<HandoverRecord> findByBooking_IdOrderByRecordedAtDesc(UUID bookingId);

    java.util.Optional<HandoverRecord> findTopByBooking_IdAndRecordTypeOrderByRecordedAtDesc(UUID bookingId, String recordType);

    boolean existsByBooking_IdAndRecordType(UUID bookingId, String recordType);

    @org.springframework.data.jpa.repository.Query("SELECT h FROM HandoverRecord h WHERE (h.booking.storageUnit IS NOT NULL AND h.booking.storageUnit.facility.id = :facilityId) OR (h.booking.facility IS NOT NULL AND h.booking.facility.id = :facilityId) ORDER BY h.recordedAt DESC")
    List<HandoverRecord> findAllByFacilityId(@org.springframework.data.repository.query.Param("facilityId") UUID facilityId);

    default List<HandoverRecord> findByBookingId(UUID bookingId) {
        return findByBooking_Id(bookingId);
    }
}

