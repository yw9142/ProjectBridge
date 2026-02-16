package com.bridge.backend.domain.contract;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.RecipientStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "signature_recipients")
public class SignatureRecipientEntity extends TenantScopedEntity {
    @Column(name = "envelope_id", nullable = false)
    private UUID envelopeId;

    @Column(name = "recipient_email", nullable = false, length = 320)
    private String recipientEmail;

    @Column(name = "recipient_name", nullable = false, length = 120)
    private String recipientName;

    @Column(name = "recipient_token", nullable = false, unique = true, length = 120)
    private String recipientToken;

    @Column(name = "signing_order", nullable = false)
    private int signingOrder = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecipientStatus status = RecipientStatus.PENDING;
}
