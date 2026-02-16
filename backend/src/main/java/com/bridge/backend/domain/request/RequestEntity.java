package com.bridge.backend.domain.request;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.RequestStatus;
import com.bridge.backend.common.model.enums.RequestType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "requests")
public class RequestEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private RequestType type;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(length = 4000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private RequestStatus status = RequestStatus.DRAFT;

    @Column(name = "assignee_user_id")
    private UUID assigneeUserId;

    @Column(name = "due_at")
    private OffsetDateTime dueAt;
}
