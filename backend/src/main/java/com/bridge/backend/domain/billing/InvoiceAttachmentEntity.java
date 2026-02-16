package com.bridge.backend.domain.billing;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.InvoiceAttachmentType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "invoice_attachments")
public class InvoiceAttachmentEntity extends TenantScopedEntity {
    @Column(name = "invoice_id", nullable = false)
    private UUID invoiceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "attachment_type", nullable = false, length = 30)
    private InvoiceAttachmentType attachmentType = InvoiceAttachmentType.OTHER;

    @Column(name = "object_key", nullable = false, length = 400)
    private String objectKey;
}
