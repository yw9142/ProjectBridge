package com.bridge.backend.domain.vault;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VaultAccessRequestRepository extends JpaRepository<VaultAccessRequestEntity, UUID> {
    List<VaultAccessRequestEntity> findBySecretIdAndTenantIdAndDeletedAtIsNull(UUID secretId, UUID tenantId);

    Optional<VaultAccessRequestEntity> findTopBySecretIdAndRequesterUserIdAndTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(
            UUID secretId, UUID requesterUserId, UUID tenantId
    );
}
