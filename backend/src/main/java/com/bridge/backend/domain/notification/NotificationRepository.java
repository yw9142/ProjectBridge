package com.bridge.backend.domain.notification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {
    List<NotificationEntity> findByUserIdAndTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId, UUID tenantId);

    Optional<NotificationEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, UUID tenantId);
}
