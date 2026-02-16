package com.bridge.backend.domain.vault;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.VaultSecretStatus;
import com.bridge.backend.common.model.enums.VaultSecretType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;
import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "vault_secrets")
public class VaultSecretEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "site_url", length = 500)
    private String siteUrl;

    @Column(name = "request_reason", length = 2000)
    private String requestReason;

    @Column(name = "requested_by_user_id")
    private UUID requestedByUserId;

    @Column(name = "provided_by_user_id")
    private UUID providedByUserId;

    @Column(name = "provided_at")
    private OffsetDateTime providedAt;

    @Column(name = "credential_ready", nullable = false)
    private boolean credentialReady;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private VaultSecretType type;

    @Column(name = "secret_ciphertext", nullable = false, length = 6000)
    private String secretCiphertext;

    @Column(nullable = false, length = 48)
    private String nonce;

    @Column(nullable = false)
    private int version = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VaultSecretStatus status = VaultSecretStatus.ACTIVE;
}
