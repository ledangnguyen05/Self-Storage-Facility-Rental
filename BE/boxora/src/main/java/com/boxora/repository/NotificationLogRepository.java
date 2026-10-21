package com.boxora.repository;

import com.boxora.entity.NotificationLog;
import com.boxora.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationLogRepository extends JpaRepository<NotificationLog, UUID>, JpaSpecificationExecutor<NotificationLog> {

    boolean existsByNotificationTypeAndReferenceId(NotificationType notificationType, UUID referenceId);

    boolean existsByNotificationTypeAndReferenceIdAndStatus(NotificationType notificationType, UUID referenceId, String status);

    Page<NotificationLog> findByRecipientId(UUID recipientId, Pageable pageable);

    Page<NotificationLog> findByFacilityId(UUID facilityId, Pageable pageable);

    List<NotificationLog> findByNotificationTypeAndReferenceId(NotificationType notificationType, UUID referenceId);

    long countByRecipient_IdAndReadAtIsNull(UUID recipientId);

    java.util.Optional<NotificationLog> findFirstByNotificationTypeAndReferenceIdAndChannelOrderByCreatedAtDesc(
            NotificationType notificationType, UUID referenceId, com.boxora.enums.NotificationChannel channel);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE NotificationLog n SET n.readAt = :now "
            + "WHERE n.recipient.id = :recipientId AND n.readAt IS NULL")
    int markAllRead(@org.springframework.data.repository.query.Param("recipientId") UUID recipientId,
                    @org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);
}
