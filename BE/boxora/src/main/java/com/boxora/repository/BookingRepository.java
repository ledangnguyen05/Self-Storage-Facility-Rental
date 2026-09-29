package com.boxora.repository;

import com.boxora.entity.Booking;
import com.boxora.enums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID>, JpaSpecificationExecutor<Booking> {

    List<Booking> findByCustomer_Id(UUID customerId);

    List<Booking> findByStatusIn(Collection<BookingStatus> statuses);

    boolean existsByStorageUnit_Id(UUID storageUnitId);

    boolean existsByStorageUnit_IdAndStatusIn(UUID storageUnitId, Collection<BookingStatus> statuses);
}
