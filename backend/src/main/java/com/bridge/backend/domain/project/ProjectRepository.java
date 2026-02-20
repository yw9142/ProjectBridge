package com.bridge.backend.domain.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<ProjectEntity, UUID> {
    List<ProjectEntity> findByTenantIdAndDeletedAtIsNull(UUID tenantId);

    List<ProjectEntity> findByIdInAndTenantIdAndDeletedAtIsNull(Collection<UUID> ids, UUID tenantId);
}
