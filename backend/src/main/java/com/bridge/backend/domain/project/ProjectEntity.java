package com.bridge.backend.domain.project;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.ProjectStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "projects")
public class ProjectEntity extends TenantScopedEntity {
    @Column(nullable = false, length = 160)
    private String name;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProjectStatus status = ProjectStatus.ACTIVE;
}
