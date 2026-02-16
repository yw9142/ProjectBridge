package com.bridge.backend.common.model;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@MappedSuperclass
public abstract class TenantScopedEntity extends BaseEntity {
    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;
}
