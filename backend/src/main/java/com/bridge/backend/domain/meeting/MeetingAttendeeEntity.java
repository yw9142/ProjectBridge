package com.bridge.backend.domain.meeting;

import com.bridge.backend.common.model.TenantScopedEntity;
import com.bridge.backend.common.model.enums.AttendeeResponse;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "meeting_attendees")
public class MeetingAttendeeEntity extends TenantScopedEntity {
    @Column(name = "meeting_id", nullable = false)
    private UUID meetingId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttendeeResponse response = AttendeeResponse.INVITED;
}
