package com.bridge.backend.domain.decision;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.DecisionStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "decisions")
public class DecisionEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 4000)
    private String rationale;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DecisionStatus status = DecisionStatus.PROPOSED;

    @Column(name = "related_file_version_id")
    private UUID relatedFileVersionId;
}
