package com.bridge.backend.domain.meeting;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.MeetingStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "meetings")
public class MeetingEntity extends TenantScopedEntity {
    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(name = "start_at", nullable = false)
    private OffsetDateTime startAt;

    @Column(name = "end_at", nullable = false)
    private OffsetDateTime endAt;

    @Column(name = "meet_url", length = 500)
    private String meetUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MeetingStatus status = MeetingStatus.SCHEDULED;
}
