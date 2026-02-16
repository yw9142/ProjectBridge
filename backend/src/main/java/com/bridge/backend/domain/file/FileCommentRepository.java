package com.bridge.backend.domain.file;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FileCommentRepository extends JpaRepository<FileCommentEntity, UUID> {
    List<FileCommentEntity> findByFileVersionIdAndTenantIdAndDeletedAtIsNull(UUID fileVersionId, UUID tenantId);
}
