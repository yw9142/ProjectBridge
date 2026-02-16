package com.bridge.backend.domain.meeting;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MeetingAttendeeRepository extends JpaRepository<MeetingAttendeeEntity, UUID> {
    List<MeetingAttendeeEntity> findByMeetingIdAndTenantIdAndDeletedAtIsNull(UUID meetingId, UUID tenantId);

    Optional<MeetingAttendeeEntity> findByMeetingIdAndUserIdAndTenantIdAndDeletedAtIsNull(UUID meetingId, UUID userId, UUID tenantId);
}
