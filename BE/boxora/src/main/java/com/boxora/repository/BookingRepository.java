package com.boxora.repository;

import com.boxora.entity.Booking;
import com.boxora.enums.BookingStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends MongoRepository<Booking, UUID> {
    Optional<Booking> findByBookingCode(String bookingCode);
    List<Booking> findByCustomer_Id(UUID customerId);
    List<Booking> findByStatus(BookingStatus status);
    List<Booking> findByStorageUnit_Id(UUID storageUnitId);
}
