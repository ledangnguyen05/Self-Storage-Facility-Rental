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

    Page<NotificationLog> findByRecipientId(UUID recipientId, Pageable pageable);

    Page<NotificationLog> findByFacilityId(UUID facilityId, Pageable pageable);

    List<NotificationLog> findByNotificationTypeAndReferenceId(NotificationType notificationType, UUID referenceId);
}
