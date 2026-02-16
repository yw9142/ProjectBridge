package com.bridge.backend.domain.billing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceAttachmentRepository extends JpaRepository<InvoiceAttachmentEntity, UUID> {
    List<InvoiceAttachmentEntity> findByInvoiceIdAndTenantIdAndDeletedAtIsNull(UUID invoiceId, UUID tenantId);
}
