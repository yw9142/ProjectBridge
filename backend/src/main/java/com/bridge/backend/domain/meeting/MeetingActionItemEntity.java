package com.bridge.backend.domain.meeting;

import com.bridge.backend.common.model.TenantScopedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "meeting_action_items")
public class MeetingActionItemEntity extends TenantScopedEntity {
    @Column(name = "meeting_id", nullable = false)
    private UUID meetingId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(name = "assignee_user_id")
    private UUID assigneeUserId;

    @Column(name = "due_at")
    private OffsetDateTime dueAt;

    @Column(nullable = false)
    private boolean done;
}
