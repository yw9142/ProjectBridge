package com.bridge.backend.domain.contract;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.SignatureFieldType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "signature_fields")
public class SignatureFieldEntity extends TenantScopedEntity {
    @Column(name = "envelope_id", nullable = false)
    private UUID envelopeId;

    @Column(name = "recipient_id", nullable = false)
    private UUID recipientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SignatureFieldType type;

    @Column(nullable = false)
    private int page;

    @Column(name = "coord_x", nullable = false)
    private double coordX;

    @Column(name = "coord_y", nullable = false)
    private double coordY;

    @Column(name = "coord_w", nullable = false)
    private double coordW;

    @Column(name = "coord_h", nullable = false)
    private double coordH;
}
