package com.bridge.backend.domain.vault;

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
@Table(name = "vault_access_events")
public class VaultAccessEventEntity extends TenantScopedEntity {
    @Column(name = "secret_id", nullable = false)
    private UUID secretId;

    @Column(name = "request_id")
    private UUID requestId;

    @Column(name = "viewer_user_id", nullable = false)
    private UUID viewerUserId;
}
