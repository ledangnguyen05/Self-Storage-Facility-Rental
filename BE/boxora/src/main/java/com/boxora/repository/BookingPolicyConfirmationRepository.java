package com.boxora.repository;

import com.boxora.entity.BookingPolicyConfirmation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingPolicyConfirmationRepository extends JpaRepository<BookingPolicyConfirmation, UUID> {

    Optional<BookingPolicyConfirmation> findTopByBooking_IdOrderByConfirmedAtDesc(UUID bookingId);

    Optional<BookingPolicyConfirmation> findByBooking_IdAndPolicyVersion(UUID bookingId, String policyVersion);

    List<BookingPolicyConfirmation> findAllByBooking_Id(UUID bookingId);

    boolean existsByBooking_IdAndPolicyVersion(UUID bookingId, String policyVersion);
}
