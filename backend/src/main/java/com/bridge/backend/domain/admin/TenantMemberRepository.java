package com.bridge.backend.domain.admin;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantMemberRepository extends JpaRepository<TenantMemberEntity, UUID> {
    List<TenantMemberEntity> findByTenantIdAndDeletedAtIsNull(UUID tenantId);

    Optional<TenantMemberEntity> findByTenantIdAndUserIdAndDeletedAtIsNull(UUID tenantId, UUID userId);

    List<TenantMemberEntity> findByUserIdAndDeletedAtIsNull(UUID userId);
}
