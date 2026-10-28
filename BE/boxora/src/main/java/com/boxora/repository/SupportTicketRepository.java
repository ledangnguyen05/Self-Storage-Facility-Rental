package com.boxora.repository;

import com.boxora.entity.SupportTicket;
import com.boxora.enums.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupportTicketRepository extends JpaRepository<SupportTicket, UUID>, JpaSpecificationExecutor<SupportTicket> {
    Optional<SupportTicket> findByTicketCode(String ticketCode);
    List<SupportTicket> findByCustomer_Id(UUID customerId);
    List<SupportTicket> findByStatus(TicketStatus status);
    List<SupportTicket> findByFacility_Id(UUID facilityId);
    List<SupportTicket> findByAssignedStaff_Id(UUID staffId);
    List<SupportTicket> findByFacility_IdOrAssignedStaff_Id(UUID facilityId, UUID staffId);
    List<SupportTicket> findByBooking_IdOrderByCreatedAtDesc(UUID bookingId);
    List<SupportTicket> findByStorageUnit_IdOrderByCreatedAtDesc(UUID storageUnitId);
}
