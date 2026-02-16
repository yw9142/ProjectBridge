package com.bridge.backend.domain.request;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RequestEventRepository extends JpaRepository<RequestEventEntity, UUID> {
    List<RequestEventEntity> findByRequestIdAndTenantIdAndDeletedAtIsNull(UUID requestId, UUID tenantId);
}
