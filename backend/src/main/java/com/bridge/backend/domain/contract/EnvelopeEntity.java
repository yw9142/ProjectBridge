package com.bridge.backend.domain.contract;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.EnvelopeStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "signature_envelopes")
public class EnvelopeEntity extends TenantScopedEntity {
    @Column(name = "contract_id", nullable = false)
    private UUID contractId;

    @Column(nullable = false, length = 300)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EnvelopeStatus status = EnvelopeStatus.DRAFT;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
