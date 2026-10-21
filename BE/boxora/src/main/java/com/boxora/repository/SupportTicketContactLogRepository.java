package com.boxora.repository;

import com.boxora.entity.SupportTicketContactLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SupportTicketContactLogRepository extends JpaRepository<SupportTicketContactLog, UUID> {
    List<SupportTicketContactLog> findByTicket_IdOrderByCreatedAtDesc(UUID ticketId);

    long countByTicket_Id(UUID ticketId);

    /** Rows of {ticketId, count} for a whole page of tickets in one query. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT c.ticket.id, COUNT(c) FROM SupportTicketContactLog c WHERE c.ticket.id IN :ids GROUP BY c.ticket.id")
    List<Object[]> countGroupedByTicketIds(@org.springframework.data.repository.query.Param("ids") java.util.Collection<UUID> ids);
}
