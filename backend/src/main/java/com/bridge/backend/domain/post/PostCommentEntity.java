package com.bridge.backend.domain.post;

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
@Table(name = "post_comments")
public class PostCommentEntity extends TenantScopedEntity {
    @Column(name = "post_id", nullable = false)
    private UUID postId;

    @Column(nullable = false, length = 4000)
    private String body;
}
