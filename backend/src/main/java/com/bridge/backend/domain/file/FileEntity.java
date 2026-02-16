package com.bridge.backend.domain.file;

import com.bridge.backend.common.model.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "files")
public class FileEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 300)
    private String name;

    @Column(length = 4000)
    private String description;

    @Column(nullable = false, length = 400)
    private String folder;
}
