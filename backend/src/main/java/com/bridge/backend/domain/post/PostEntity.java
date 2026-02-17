package com.bridge.backend.domain.post;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.PostType;
import com.bridge.backend.common.model.enums.VisibilityScope;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "posts")
public class PostEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PostType type;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(nullable = false, length = 8000)
    private String body;

    @Column(nullable = false)
    private boolean pinned;

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility_scope", nullable = false, length = 20)
    private VisibilityScope visibilityScope = VisibilityScope.SHARED;
}
