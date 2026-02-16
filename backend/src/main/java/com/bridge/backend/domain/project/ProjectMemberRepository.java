package com.bridge.backend.domain.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectMemberRepository extends JpaRepository<ProjectMemberEntity, UUID> {
    List<ProjectMemberEntity> findByProjectIdAndDeletedAtIsNull(UUID projectId);

    Optional<ProjectMemberEntity> findByProjectIdAndUserIdAndDeletedAtIsNull(UUID projectId, UUID userId);

    List<ProjectMemberEntity> findByUserIdAndTenantIdAndDeletedAtIsNull(UUID userId, UUID tenantId);
}
