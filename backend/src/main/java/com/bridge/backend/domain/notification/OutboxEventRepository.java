package com.bridge.backend.domain.notification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, UUID> {
    List<OutboxEventEntity> findTop100ByProcessedAtIsNullOrderByCreatedAtAsc();

    List<OutboxEventEntity> findTop200ByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID tenantId);
}
