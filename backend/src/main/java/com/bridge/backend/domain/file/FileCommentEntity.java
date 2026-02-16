package com.bridge.backend.domain.file;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.FileCommentStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "file_comments")
public class FileCommentEntity extends TenantScopedEntity {
    @Column(name = "file_version_id", nullable = false)
    private UUID fileVersionId;

    @Column(nullable = false, length = 4000)
    private String body;

    @Column(name = "coord_x", nullable = false)
    private double coordX;

    @Column(name = "coord_y", nullable = false)
    private double coordY;

    @Column(name = "coord_w", nullable = false)
    private double coordW;

    @Column(name = "coord_h", nullable = false)
    private double coordH;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FileCommentStatus status = FileCommentStatus.OPEN;
}
