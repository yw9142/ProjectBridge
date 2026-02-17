package com.bridge.backend.domain.file;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileFolderRepository extends JpaRepository<FileFolderEntity, UUID> {
    List<FileFolderEntity> findByProjectIdAndTenantIdAndDeletedAtIsNullOrderByPathAsc(UUID projectId, UUID tenantId);

    Optional<FileFolderEntity> findByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(UUID projectId, UUID tenantId, String path);

    boolean existsByProjectIdAndTenantIdAndPathAndDeletedAtIsNull(UUID projectId, UUID tenantId, String path);
}
