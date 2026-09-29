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
}
