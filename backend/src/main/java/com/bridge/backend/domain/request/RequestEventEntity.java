package com.bridge.backend.domain.request;

import com.bridge.backend.common.model.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "request_events")
public class RequestEventEntity extends TenantScopedEntity {
    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "event_type", nullable = false, length = 80)
    private String eventType;

    @Column(name = "event_payload", length = 6000)
    private String eventPayload;
}
