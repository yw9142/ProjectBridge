package com.bridge.backend.domain.vault;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VaultAccessEventRepository extends JpaRepository<VaultAccessEventEntity, UUID> {
    long countBySecretIdAndTenantIdAndViewerUserIdAndDeletedAtIsNull(UUID secretId, UUID tenantId, UUID viewerUserId);
}
