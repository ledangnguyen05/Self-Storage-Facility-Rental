package com.boxora.repository;

import com.boxora.entity.SupportTicketContactLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SupportTicketContactLogRepository extends JpaRepository<SupportTicketContactLog, UUID> {
    List<SupportTicketContactLog> findByTicket_IdOrderByCreatedAtDesc(UUID ticketId);
}
