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
@Table(name = "file_versions")
public class FileVersionEntity extends TenantScopedEntity {
    @Column(name = "file_id", nullable = false)
    private UUID fileId;

    @Column(nullable = false)
    private int version;

    @Column(name = "object_key", nullable = false, length = 400)
    private String objectKey;

    @Column(name = "content_type", nullable = false, length = 120)
    private String contentType;

    @Column(nullable = false)
    private long size;

    @Column(nullable = false, length = 120)
    private String checksum;

    @Column(name = "is_latest", nullable = false)
    private boolean latest;
}
