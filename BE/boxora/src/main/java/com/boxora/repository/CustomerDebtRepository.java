package com.boxora.repository;

import com.boxora.entity.CustomerDebt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CustomerDebtRepository extends JpaRepository<CustomerDebt, UUID>, JpaSpecificationExecutor<CustomerDebt> {

    List<CustomerDebt> findByBooking_Id(UUID bookingId);

    List<CustomerDebt> findByCustomer_IdAndStatus(UUID customerId, String status);
}
