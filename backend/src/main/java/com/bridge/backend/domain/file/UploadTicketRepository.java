package com.bridge.backend.domain.file;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UploadTicketRepository extends JpaRepository<UploadTicketEntity, UUID> {
    Optional<UploadTicketEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, UUID tenantId);
}
