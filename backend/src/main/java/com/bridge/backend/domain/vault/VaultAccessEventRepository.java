package com.bridge.backend.domain.vault;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VaultAccessEventRepository extends JpaRepository<VaultAccessEventEntity, UUID> {
    long countBySecretIdAndViewerUserIdAndTenantIdAndDeletedAtIsNull(UUID secretId, UUID viewerUserId, UUID tenantId);
}
