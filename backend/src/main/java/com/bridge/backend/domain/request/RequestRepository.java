package com.bridge.backend.domain.request;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RequestRepository extends JpaRepository<RequestEntity, UUID> {
    List<RequestEntity> findByProjectIdAndTenantIdAndDeletedAtIsNull(UUID projectId, UUID tenantId);
}
