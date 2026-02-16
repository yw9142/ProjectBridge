package com.bridge.backend.domain.billing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<InvoiceEntity, UUID> {
    List<InvoiceEntity> findByProjectIdAndTenantIdAndDeletedAtIsNull(UUID projectId, UUID tenantId);
}
