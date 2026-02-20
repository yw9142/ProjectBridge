package com.bridge.backend.domain.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, UUID> {
    @Query(value = """
            SELECT oe.id
            FROM outbox_events oe
            WHERE oe.processed_at IS NULL
              AND oe.deleted_at IS NULL
            ORDER BY oe.created_at ASC
            LIMIT :batchSize
            FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    List<UUID> claimUnprocessedBatchForUpdate(@Param("batchSize") int batchSize);

    List<OutboxEventEntity> findTop200ByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID tenantId);

    List<OutboxEventEntity> findByIdInOrderByCreatedAtAsc(List<UUID> ids);
}
