package com.bridge.backend.domain.vault;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VaultPolicyRepository extends JpaRepository<VaultPolicyEntity, UUID> {
    List<VaultPolicyEntity> findByProjectIdAndTenantIdAndDeletedAtIsNull(UUID projectId, UUID tenantId);
}
