package com.bridge.backend.domain.vault;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VaultSecretRepository extends JpaRepository<VaultSecretEntity, UUID> {
    List<VaultSecretEntity> findByProjectIdAndTenantIdAndDeletedAtIsNull(UUID projectId, UUID tenantId);
}
