package com.bridge.backend.domain.file;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileVersionRepository extends JpaRepository<FileVersionEntity, UUID> {
    List<FileVersionEntity> findByFileIdAndTenantIdAndDeletedAtIsNullOrderByVersionDesc(UUID fileId, UUID tenantId);

    Optional<FileVersionEntity> findByFileIdAndTenantIdAndLatestTrueAndDeletedAtIsNull(UUID fileId, UUID tenantId);
}
