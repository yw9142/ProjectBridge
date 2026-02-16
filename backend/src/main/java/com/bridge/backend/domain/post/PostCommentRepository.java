package com.bridge.backend.domain.post;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PostCommentRepository extends JpaRepository<PostCommentEntity, UUID> {
    List<PostCommentEntity> findByPostIdAndTenantIdAndDeletedAtIsNull(UUID postId, UUID tenantId);
}
