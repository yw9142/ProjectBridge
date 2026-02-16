package com.bridge.backend.domain.notification;

import com.bridge.backend.common.model.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "outbox_events")
public class OutboxEventEntity extends TenantScopedEntity {
    @Column(name = "aggregate_type", nullable = false, length = 80)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false)
    private UUID aggregateId;

    @Column(name = "event_type", nullable = false, length = 120)
    private String eventType;

    @Column(name = "event_payload", nullable = false, length = 6000)
    private String eventPayload;

    @Column(name = "processed_at")
    private OffsetDateTime processedAt;
}
