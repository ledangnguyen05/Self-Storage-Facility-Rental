package com.boxora.repository;

import com.boxora.entity.SupportTicket;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SupportTicketRepository extends MongoRepository<SupportTicket, UUID> {
    Optional<SupportTicket> findByTicketCode(String ticketCode);
    List<SupportTicket> findByCustomer_Id(UUID customerId);
    List<SupportTicket> findByStatus(String status);
}
