package com.bridge.backend.domain.meeting;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MeetingAttendeeRepository extends JpaRepository<MeetingAttendeeEntity, UUID> {
    List<MeetingAttendeeEntity> findByMeetingIdAndTenantIdAndDeletedAtIsNull(UUID meetingId, UUID tenantId);

    List<MeetingAttendeeEntity> findByMeetingIdInAndTenantIdAndDeletedAtIsNull(Collection<UUID> meetingIds, UUID tenantId);

    Optional<MeetingAttendeeEntity> findByMeetingIdAndUserIdAndTenantIdAndDeletedAtIsNull(UUID meetingId, UUID userId, UUID tenantId);
}
