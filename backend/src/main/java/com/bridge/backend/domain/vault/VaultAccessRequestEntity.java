package com.bridge.backend.domain.vault;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.VaultAccessRequestStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "vault_access_requests")
public class VaultAccessRequestEntity extends TenantScopedEntity {
    @Column(name = "secret_id", nullable = false)
    private UUID secretId;

    @Column(name = "requester_user_id", nullable = false)
    private UUID requesterUserId;

    @Column(name = "approver_user_id")
    private UUID approverUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VaultAccessRequestStatus status = VaultAccessRequestStatus.REQUESTED;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;
}
