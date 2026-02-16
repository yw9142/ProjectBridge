package com.bridge.backend.domain.billing;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.InvoicePhase;
import com.bridge.backend.common.model.enums.InvoiceStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "invoices")
public class InvoiceEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "invoice_number", nullable = false, length = 80)
    private String invoiceNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InvoicePhase phase = InvoicePhase.FINAL;

    @Column(nullable = false)
    private long amount;

    @Column(nullable = false, length = 20)
    private String currency = "KRW";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    @Column(name = "due_at")
    private OffsetDateTime dueAt;
}
