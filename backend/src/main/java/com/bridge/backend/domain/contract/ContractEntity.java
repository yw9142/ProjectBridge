package com.bridge.backend.domain.contract;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.ContractStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "contracts")
public class ContractEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 300)
    private String name;

    @Column(name = "file_version_id")
    private UUID fileVersionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContractStatus status = ContractStatus.DRAFT;
}
