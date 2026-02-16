package com.bridge.backend.domain.contract;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.SignatureEventType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "signature_events")
public class SignatureEventEntity extends TenantScopedEntity {
    @Column(name = "envelope_id", nullable = false)
    private UUID envelopeId;

    @Column(name = "recipient_id")
    private UUID recipientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 20)
    private SignatureEventType eventType;

    @Column(name = "event_payload", length = 6000)
    private String eventPayload;
}
